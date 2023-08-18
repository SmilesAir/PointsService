"use strict"

const MainStore = require("mainStore.js")
const Endpoints = require("endpoints.js")

let Common = module.exports

module.exports.fetchEx = function(key, pathParams, queryParams, options) {
    return fetch(Endpoints.buildUrl(key, pathParams, queryParams), options).then((response) => {
        return response.json()
    })
}

function isValidText(str) {
    return str !== undefined && str !== null && str.length > 0
}

module.exports.getDisplayNameFromPlayerData = function(playerData) {
    let displayName = ""
    if (isValidText(playerData.firstName) && isValidText(playerData.lastName)) {
        displayName = playerData.firstName.toLowerCase() + "_" + playerData.lastName.toLowerCase()
    } else if (isValidText(playerData.firstName)) {
        displayName = playerData.firstName.toLowerCase()
    }else if (isValidText(playerData.lastName)) {
        displayName = playerData.lastName.toLowerCase()
    }

    return displayName.replaceAll(" ", "_")
}

module.exports.getFullNameFromPlayerData = function(playerData) {
    let fullName = ""
    if (isValidText(playerData.firstName) && isValidText(playerData.lastName)) {
        fullName = playerData.firstName + " " + playerData.lastName
    } else if (isValidText(playerData.firstName)) {
        fullName = playerData.firstName
    }else if (isValidText(playerData.lastName)) {
        fullName = playerData.lastName
    }

    return fullName
}

module.exports.isValidGuid = function(guid) {
    if (guid === undefined || guid === null || guid.length < 5) {
        return false
    }

    return true
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
            MainStore.cachedDisplayNames.push(Common.getDisplayNameFromPlayerData(playerData))
        }

        ++MainStore.initCount

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

        ++MainStore.initCount

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

        ++MainStore.initCount

        console.log("resultsData", JSON.parse(JSON.stringify(MainStore.sortedResultsData)))
    }).catch((error) => {
        console.error(`Failed to download Results data: ${error}`)
    })
}

module.exports.generatePoolsRankingPointsArray = function(numPlayers, numPlaces, kFactor, bonus) {
    let topScore = Math.pow(numPlayers, 1) * kFactor + (bonus || 0)
    let base = Math.pow(topScore, 1 / (numPlaces - 1))

    let pointsArray = []
    for (let i = 0; i < numPlaces; ++i) {
        pointsArray.splice(0, 0, Math.round(topScore / Math.pow(base, i) * 10) / 10)
    }

    return pointsArray
}

module.exports.getSortedEventData = function(startTime, endTime) {
    let sortedEventData = []
    for (let eventId in MainStore.eventData) {
        let eventData = MainStore.eventData[eventId]
        if (startTime !== undefined && endTime !== undefined) {
            let eventTime = Date.parse(eventData.startDate)
            if (eventTime < startTime || eventTime > endTime) {
                continue
            }
        }
        sortedEventData.push(eventData)
    }

    return sortedEventData.sort((a, b) => {
        return Date.parse(a.startDate) - Date.parse(b.startDate)
    })
}

module.exports.uploadPointsData = function(endpoint, date, divisionName, type, data) {
    Common.fetchEx(endpoint, {
        date: date,
        divisionName: divisionName,
        type: type
    }, {}, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    }).then((response) => {
        console.log(response)
    }).catch((error) => {
        console.error(`Failed to upload: ${error}`)
    })
}

module.exports.setDivisionData = function(endpoint, data) {
    Common.fetchEx(endpoint, {
        eventKey: data.eventId,
        divisionName: data.divisionName,
    }, {}, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    }).then((response) => {
        console.log(response)
    }).catch((error) => {
        console.error(`Failed to set division: ${error}`)
    })
}

module.exports.getOriginalPlayerData = function(playerKey) {
    let playerData = MainStore.playerData[playerKey]
    if (playerData === undefined) {
        return undefined
    }

    while (playerData.aliasKey !== undefined) {
        let originalData = MainStore.playerData[playerData.aliasKey]
        if (originalData === undefined) {
            break
        }

        playerData = originalData
    }

    return playerData
}
