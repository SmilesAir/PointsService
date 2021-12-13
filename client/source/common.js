"use strict"

const MainStore = require("mainStore.js")
const Endpoints = require("endpoints.js")

let Common = module.exports

module.exports.fetchEx = function(key, pathParams, queryParams, options) {
    return fetch(Endpoints.buildUrl(key, pathParams, queryParams), options).then((response) => {
        return response.json()
    })
}

module.exports.downloadPlayerAndEventData = function() {
    Common.fetchEx("GET_PLAYER_DATA", {}, {}, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    }).then((data) => {
        MainStore.playerData = data.players

        MainStore.cachedDisplayNames = []
        for (let id in MainStore.playerData) {
            let playerData = MainStore.playerData[id]
            MainStore.cachedDisplayNames.push(playerData.firstName.toLowerCase() + "_" + playerData.lastName.toLowerCase())
        }

        console.log("playerData", data)
    }).catch((error) => {
        console.error(`Failed to download Player data: ${error}`)
    })

    Common.fetchEx("GET_EVENT_DATA", {}, {}, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    }).then((data) => {
        MainStore.eventData = data.allEventSummaryData

        console.log("eventData", data)
    }).catch((error) => {
        console.error(`Failed to download Event data: ${error}`)
    })

    Common.fetchEx("GET_RESULTS_DATA", {}, {}, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    }).then((data) => {
        MainStore.resultsData = data.results
        let sortedResultsData = []
        for (let resultsId in MainStore.resultsData) {
            let resultsData = MainStore.resultsData[resultsId]
            if (resultsData.eventId !== undefined) {
                sortedResultsData.push(resultsData)
            }
        }

        MainStore.sortedResultsData = sortedResultsData.sort((a, b) => {
            return a.createdAt - b.createdAt
        })

        console.log("resultsData", JSON.parse(JSON.stringify(MainStore.sortedResultsData)))
    }).catch((error) => {
        console.error(`Failed to download Results data: ${error}`)
    })
}

module.exports.generatePoolsRankingPointsArray = function(numPlayers, kFactor, bonus) {
    let topScore = numPlayers * kFactor + (bonus || 0)
    let places = Math.ceil(Math.pow(numPlayers, 1 / 2))
    let base = Math.pow(topScore, 1 / (places - 1))

    let pointsArray = []
    for (let i = 0; i < places; ++i) {
        pointsArray.splice(0, 0, Math.round(topScore / Math.pow(base, i) * 10) / 10)
    }

    return pointsArray
}
