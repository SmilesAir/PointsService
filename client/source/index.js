"use strict"

const React = require("react")
const ReactDOM = require("react-dom")
const MobxReact = require("mobx-react")

const MainStore = require("mainStore.js")
const Common = require("common.js")

require("./index.less")

const globalKFactor = 5

@MobxReact.observer class Main extends React.Component {
    constructor() {
        super()

        this.state = {
            rankingsOutput: ""
        }

        Common.downloadPlayerAndEventData()

        //console.log(Common.generatePoolsRankingPointsArray(30, 5))
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

        let playerResults = []

        if (MainStore.sortedResultsData < 1) {
            return ""
        }
        let resultsData = MainStore.sortedResultsData[0]

        let roundIds = []
        for (let roundId in resultsData.resultsData) {
            if (roundId.startsWith("round")) {
                roundIds.push(roundId)
            }
        }

        // Can't handle more than 9 rounds
        roundIds = roundIds.sort((a, b) => {
            return a < b
        })

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
                            }
                        }
                    }
                }
            }
        }

        let pointsArray = Common.generatePoolsRankingPointsArray(playerResults.length, globalKFactor)
        console.log(pointsArray)

        let rankingsString = ""
        if (playerResults.length > 0) {
            let pointsArrayIndex = pointsArray.length - 1
            let currentHash = playerResults[0].hash
            for (let player of playerResults) {
                if (currentHash !== player.hash) {
                    --pointsArrayIndex
                    currentHash = player.hash
                }

                rankingsString += `${MainStore.playerData[player.id].firstName} ${player.round} ${player.place} ${pointsArray[pointsArrayIndex]}\n`
            }
        }

        return rankingsString
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
                    <h1>
                        Rankings
                    </h1>
                    <textarea value={this.getRankingsOutput()} cols={50} rows={20} readOnly={true} />
                    <h1>
                        Ratings
                    </h1>
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
