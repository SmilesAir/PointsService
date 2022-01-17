/* eslint-disable no-nested-ternary */
"use strict"

const React = require("react")
const ReactDOM = require("react-dom")
const MobxReact = require("mobx-react")

const MainStore = require("mainStore.js")
const EnumStore = require("enumStore.js")
const Common = require("common.js")

require("./index.less")

const openRankingKFactor = 5
const womenRankingKFactor = 15
const ratingKFactor = 32
const startingElo = 400
const topRankingResultsCount = 8

@MobxReact.observer class Main extends React.Component {
    constructor() {
        super()

        MainStore.rankingTypeNames[EnumStore.ERankingType.Open] = [
            "Open",
            "Open Pairs",
            "Random Open",
            "Coop",
            "Co-op",
            "Open Co-op",
            "Mixed",
            "Mixed Pairs",
        ]
        MainStore.rankingTypeNames[EnumStore.ERankingType.Women] = [
            "Women",
            "Women Pairs",
            "Mixed",
            "Mixed Pairs",
        ]

        let now = new Date()

        this.state = {
            playerRatings: {},
            playerRankings: {},
            startTime: Date.parse("2018-1-1"),
            endTime: Number.MAX_VALUE,
            date: `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
            rankingType: EnumStore.ERankingType.Open,
            rankingData: undefined
        }

        Common.downloadPlayerAndEventData()
    }

    getEventWidgets() {
        let sortedEventData = []
        for (let eventId in MainStore.eventData) {
            sortedEventData.push(MainStore.eventData[eventId])
        }

        sortedEventData = sortedEventData.sort((a, b) => {
            return Date.parse(a.startDate) - Date.parse(b.startDate)
        })

        return sortedEventData.map((data, i) => {
            return <EventWidget key={i} eventSummaryData={data} />
        })
    }

    getRankingsOutput() {
        if (MainStore.initCount < 3) {
            return ""
        }

        let sortedEventData = Common.getSortedEventData(this.state.startTime, this.state.endTime)
        for (let eventData of sortedEventData) {
            let resultsDataList = MainStore.sortedResultsData.filter((data) => data.eventId === eventData.key)
            for (let resultsData of resultsDataList) {
                if (MainStore.rankingTypeNames[this.state.rankingType].includes(resultsData.divisionName)) {
                    this.calcResultsRanking(resultsData)
                }
            }
        }

        let rankingsString = ""
        let sortedRankingList = []
        for (let playerKey in this.state.playerRankings) {
            let rankingData = this.state.playerRankings[playerKey]
            rankingData.pointsList = rankingData.pointsList.sort((a, b) => {
                return b.points - a.points
            })
            let topRankings = rankingData.pointsList.slice(0, topRankingResultsCount)
            rankingData.points = 0
            for (let ranking of topRankings) {
                rankingData.points += ranking.points
            }
            sortedRankingList.push(rankingData)
        }

        sortedRankingList = sortedRankingList.sort((a, b) => {
            return b.points - a.points
        })

        let place = 1
        for (let rankingData of sortedRankingList) {
            rankingData.rank = place
            rankingsString += `${place++}\t${rankingData.fullName}\t${Math.round(rankingData.points)}\t${rankingData.resultsCount}\t${Math.round(rankingData.points / rankingData.resultsCount)}\n`
        }

        this.state.rankingData = sortedRankingList

        return rankingsString
    }

    calcResultsRanking(resultsData) {
        let playerResults = []

        let roundIds = []
        for (let roundId in resultsData.resultsData) {
            if (roundId.startsWith("round")) {
                roundIds.push(roundId)
            }
        }

        // Can't handle more than 9 rounds
        roundIds = roundIds.sort((a, b) => {
            return a - b
        })

        let hashObj = {}
        let placeCount = 0
        for (let roundId of roundIds) {
            let roundData = resultsData.resultsData[roundId]
            for (let poolId in roundData) {
                if (poolId.startsWith("pool")) {
                    let poolData = roundData[poolId]
                    for (let teamData of poolData.teamData) {
                        for (let playerId of teamData.players) {
                            if (playerResults.find((data) => data.id === playerId) === undefined) {
                                let result = {
                                    id: playerId,
                                    round: parseInt(roundId.replace("round", ""), 10),
                                    place: teamData.place,
                                }
                                result.hash = result.round * 1000 + result.place
                                playerResults.push(result)

                                if (hashObj[result.hash] === undefined) {
                                    hashObj[result.hash] = result.hash
                                    ++placeCount
                                }
                            }
                        }
                    }
                }
            }
        }

        playerResults = playerResults.sort((a, b) => {
            return a.hash - b.hash
        })

        if (playerResults.length > 0) {
            let pointsArray = Common.generatePoolsRankingPointsArray(playerResults.length, placeCount,
                this.state.rankingType === EnumStore.ERankingType.Open ? openRankingKFactor : womenRankingKFactor)

            let pointsArrayIndex = pointsArray.length - 1
            let currentHash = playerResults[0].hash
            for (let player of playerResults) {
                if (currentHash !== player.hash) {
                    --pointsArrayIndex
                    currentHash = player.hash
                }

                let playerData = MainStore.playerData[player.id]
                let rankingData = this.state.playerRankings[player.id]
                if (rankingData !== undefined) {
                    rankingData.pointsList.push({
                        resultsId: resultsData.key,
                        points: pointsArray[pointsArrayIndex]
                    })
                    ++rankingData.resultsCount
                // eslint-disable-next-line eqeqeq
                } else if (this.state.rankingType != EnumStore.ERankingType.Women || playerData.gender === "F") {
                    this.state.playerRankings[player.id] = {
                        id: player.id,
                        fullName: playerData.firstName + " " + playerData.lastName,
                        pointsList: [ {
                            resultsId: resultsData.key,
                            points: pointsArray[pointsArrayIndex]
                        } ],
                        resultsCount: 1
                    }
                }

                // if (playerData.lastName === "Korver") {
                //     let eventData = MainStore.eventData[resultsData.eventId]
                //     console.log(eventData.eventName, currentHash, pointsArray[pointsArrayIndex])
                // }
            }
        }
    }

    getRatingsOutput() {
        if (MainStore.isRatingCalcEnabled !== true) {
            return ""
        }

        if (MainStore.initCount < 3) {
            return ""
        }

        let sortedEventData = Common.getSortedEventData()
        //console.log(JSON.parse(JSON.stringify(sortedEventData)))

        for (let eventData of sortedEventData) {
            let resultsDataList = MainStore.sortedResultsData.filter((data) => data.eventId === eventData.key)
            for (let resultsData of resultsDataList) {
                this.calcResultsElo(resultsData, eventData.startDate)
            }
        }

        let sortedRatingData = []
        for (let playerId in this.state.playerRatings) {
            sortedRatingData.push(this.state.playerRatings[playerId])
        }

        sortedRatingData = sortedRatingData.sort((a, b) => {
            return b.rating - a.rating
        })

        let outText = ""
        let place = 1
        for (let player of sortedRatingData) {
            outText += `${place}.\t${player.fullName}\t${Math.round(player.rating)}\t${player.matchCount}\t${Math.round(player.highestRating)}\t${player.highestRatingDate}\t${player.highestRank}\t${player.highestRankDate}\n`
            ++place
        }

        return outText
    }

    calcResultsElo(resultsData, startDate) {
        let roundIds = []
        for (let roundId in resultsData.resultsData) {
            if (roundId.startsWith("round")) {
                roundIds.push(roundId)
            }
        }

        // Can't handle more than 9 rounds
        roundIds = roundIds.sort((a, b) => {
            return a - b
        })

        let teamsData = []
        for (let roundId of roundIds) {
            let roundData = resultsData.resultsData[roundId]
            for (let poolId in roundData) {
                if (poolId.startsWith("pool")) {
                    let poolData = roundData[poolId]
                    for (let teamData of poolData.teamData) {
                        let hash = teamData.players.join(",")
                        if (teamsData.find((data) => data.hash === hash) === undefined) {
                            teamsData.push({
                                place: teamData.place + 1000 * parseInt(roundId.replace("round", ""), 10),
                                players: teamData.players.slice(),
                                hash: hash
                            })
                        }
                    }
                }
            }
        }

        teamsData = teamsData.sort((a, b) => {
            return a.place - b.place
        })

        let lastHash = null
        for (let winnerIndex = 0; winnerIndex < teamsData.length; ++winnerIndex) {
            let winner = teamsData[winnerIndex]
            for (let loserIndex = winnerIndex + 1; loserIndex < teamsData.length; ++loserIndex) {
                let loser = teamsData[loserIndex]
                let isTie = winner.place === loser.place
                if (!isTie || lastHash !== loser.hash) {
                    this.calcTeamRating(winner, loser, isTie ? 0 : -1, startDate)
                    lastHash = loser.hash
                }
            }
        }

        let sortedPlayerRatings = []
        for (let playerId in this.state.playerRatings) {
            sortedPlayerRatings.push(this.state.playerRatings[playerId])
        }

        sortedPlayerRatings = sortedPlayerRatings.sort((a, b) => {
            return b.rating - a.rating
        })

        for (let i = 0; i < sortedPlayerRatings.length; ++i) {
            let rank = i + 1
            let player = sortedPlayerRatings[i]
            if (player.matchCount > 100 && (player.highestRank < 0 || rank < player.highestRank)) {
                player.highestRank = rank
                player.highestRankDate = startDate
            }
        }
    }

    calcTeamRating(team1, team2, result, startDate) {
        let rating1 = this.calcTeamElo(team1)
        let rating2 = this.calcTeamElo(team2)

        let ratingResults = this.calcEloMatch(rating1, rating2, result)
        let team1Delta = ratingResults.rating1 - rating1
        let team2Delta = ratingResults.rating2 - rating2

        let found = team1.players.find((playerId) => {
            let playerData = MainStore.playerData[playerId]
            return playerData.lastName === "Damiano"
        })
        if (!found) {
            found = team2.players.find((playerId) => {
                let playerData = MainStore.playerData[playerId]
                return playerData.lastName === "Damiano"
            })
        }
        if (found) {
            let out = ""
            for (let playerId of team1.players) {
                let playerData = MainStore.playerData[playerId]
                let ratingData = this.state.playerRatings[playerId]
                let rating = ratingData && ratingData.rating || startingElo
                out += `${playerData.firstName} ${rating} `
            }
            out += " vs  "
            for (let playerId of team2.players) {
                let playerData = MainStore.playerData[playerId]
                let ratingData = this.state.playerRatings[playerId]
                let rating = ratingData && ratingData.rating || startingElo
                out += `${playerData.firstName} ${rating} `
            }

            out += ` ${result}`

            //console.log(out)
        }

        this.updateTeamRatings(team1, rating1, team1Delta, startDate)
        this.updateTeamRatings(team2, rating2, team2Delta, startDate)
    }

    updateTeamRatings(team, originalRating, delta, startDate) {
        for (let playerId of team.players) {
            let ratingData = this.state.playerRatings[playerId]
            let rating = ratingData && ratingData.rating || startingElo
            let weight = rating / originalRating / team.players.length

            if (ratingData !== undefined) {
                ratingData.rating += weight * delta
                ++ratingData.matchCount

                if (ratingData.rating > ratingData.highestRating) {
                    ratingData.highestRating = ratingData.rating
                    ratingData.highestRatingDate = startDate
                }
            } else {
                let playerData = MainStore.playerData[playerId]
                this.state.playerRatings[playerId] = {
                    fullName: playerData.firstName + " " + playerData.lastName,
                    rating: startingElo + weight * delta,
                    matchCount: 1,
                    highestRating: startingElo + weight * delta,
                    highestRatingDate: startDate,
                    highestRank: -1,
                    highestRankDate: startDate
                }
            }
        }
    }

    calcTeamElo(team) {
        let elo = 0
        // for (let playerId of team.players) {
        //     let player = this.state.playerRatings[playerId]
        //     if (player !== undefined) {
        //         elo += player.rating
        //     } else {
        //         elo += startingElo
        //     }
        // }

        // return elo / team.players.length

        let ratings = []
        for (let playerId of team.players) {
            let player = this.state.playerRatings[playerId]
            if (player !== undefined) {
                ratings.push(player.rating)
            } else {
                ratings.push(startingElo)
            }
        }

        ratings = ratings.sort((a, b) => b - a)
        let count = 0
        for (let i = 0; i < ratings.length; ++i) {
            let weight = i + 1
            elo += ratings[i] * weight
            count += weight
        }

        return elo / count
    }

    calcEloMatch(rating1, rating2, result) {
        // -1 means player1 won, 1 means player2 won, 0 means draw
        let r1 = Math.pow(10, rating1 / 400)
        let r2 = Math.pow(10, rating2 / 400)
        let e1 = r1 / (r1 + r2)
        let e2 = r2 / (r1 + r2)
        let s1 = result === 0 ? .5 : result > 0 ? 0 : 1
        let s2 = result === 0 ? .5 : result > 0 ? 1 : 0

        return {
            rating1: rating1 + ratingKFactor * (s1 - e1),
            rating2: rating2 + ratingKFactor * (s2 - e2)
        }
    }

    enableRatings() {
        MainStore.isRatingCalcEnabled = true
    }

    onRankingDateChanged(e) {
        this.state.date = e.target.value
        this.setState(this.state)
    }

    uploadRankings() {
        if (this.state.rankingData !== undefined) {
            Common.uploadPointsData("UPLOAD_RANKING_DATA", this.state.date, this.state.rankingType === EnumStore.ERankingType.Open ? "open" : "women", "ranking", this.state.rankingData)
        }
    }

    rankingTypeChanged(e) {
        this.state.rankingType = e.target.value
        this.state.playerRankings = {}
        this.setState(this.state)
    }

    render() {
        return (
            <div className="topContainer">
                <div>
                    <h1>
                        Select Results
                    </h1>
                    {this.getEventWidgets()}
                </div>
                <div className="resultsContainer">
                    <label>
                        Date:
                        <input value={this.state.date} onChange={(e) => this.onRankingDateChanged(e)}/>
                    </label>
                    <label>
                        Division:
                        <select value={this.state.rankingType} onChange={(e) => this.rankingTypeChanged(e)}>
                            <option value={EnumStore.ERankingType.Open}>Open</option>
                            <option value={EnumStore.ERankingType.Women}>Women</option>
                        </select>
                    </label>
                    <h1>
                        Rankings
                    </h1>
                    <button onClick={() => this.uploadRankings()}>Upload</button>
                    <textarea value={this.getRankingsOutput()} cols={70} rows={20} readOnly={true} />
                    <h1>
                        Ratings
                    </h1>
                    { MainStore.isRatingCalcEnabled ? null : <button onClick={(e) => this.enableRatings(e)}>Enable Ratings</button> }
                    <textarea value={this.getRatingsOutput()} cols={50} rows={20} readOnly={true} />
                </div>
            </div>
        )
    }
}

@MobxReact.observer class EventWidget extends React.Component {
    constructor() {
        super()

        this.state = {
            isExpanded: true
        }
    }

    getResultDataElements() {
        if (!this.state.isExpanded) {
            return null
        }

        let resultsData = MainStore.sortedResultsData.filter((data) => {
            return data.eventId === this.props.eventSummaryData.key
        })

        return resultsData.map((data, i) => {
            return (
                <div key={i} className="resultContainer">
                    <input type="checkbox" />
                    {data.divisionName + " - "}
                    {(new Date(data.createdAt)).toLocaleDateString()}
                </div>
            )
        })
    }

    onExpand() {
        this.state.isExpanded = !this.state.isExpanded

        this.setState(this.state)
    }

    render() {
        return (
            <div className="eventWidget">
                <div className="header">
                    <button onClick={(e) => this.onExpand(e)}>{this.state.isExpanded ? "-" : "+"}</button>
                    <div>
                        {this.props.eventSummaryData.eventName}
                    </div>
                </div>
                {this.getResultDataElements()}
            </div>
        )
    }
}

ReactDOM.render(
    <Main />,
    document.getElementById("mount")
)
