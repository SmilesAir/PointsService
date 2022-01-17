const AWS = require("aws-sdk")
let docClient = new AWS.DynamoDB.DocumentClient()
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const s3Client = new S3Client({ region: process.region })

const Common = require("./common.js")

const infoKey = "info"
const cachedDataName = "AllManifests.json"

module.exports.uploadPointsData = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let date = decodeURIComponent(event.pathParameters.date)
    let divisionName = decodeURIComponent(event.pathParameters.divisionName)
    let type = decodeURIComponent(event.pathParameters.type)
    let data = JSON.parse(event.body) || {}

    let key = await uploadData(date, divisionName, type, data)

    return {
        key: key
    }
})}

module.exports.downloadPointsData = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let key = decodeURIComponent(event.pathParameters.key)

    let getBucketParams = {
        Bucket: process.env.CACHE_BUCKET,
        Key: key + ".json"
    }
    let data = await s3Client.send(new GetObjectCommand(getBucketParams)).then((response) => {
        return streamToString(response.Body)
    }).then((dataString) => {
        return JSON.parse(dataString)
    }).catch((error) => {
        throw error
    })

    return {
        data: data
    }
})}

async function uploadData(date, divisionName, type, data) {
    let key = `${type}-${divisionName}_${date}`
    let dataPath = key + ".json"
    let putItem = {
        key: key,
        date: date,
        divisionName: divisionName,
        createdAt: Date.now(),
        dataPath: dataPath
    }

    let putParams = {
        TableName : process.env.POINTS_MANIFEST_TABLE,
        Item: putItem
    }
    await docClient.put(putParams).promise().catch((error) => {
        throw error
    })

    let putBucketParams = {
        Bucket: process.env.CACHE_BUCKET,
        Key: dataPath,
        Body: JSON.stringify(data)
    }

    await s3Client.send(new PutObjectCommand(putBucketParams)).catch((error) => {
        throw error
    })

    await setIsResultsDataDirty(true)

    return key
}

module.exports.getManifest = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    return {
        manifest: await getManifest()
    }
})}

async function getManifest() {
    let allResults
    let isResultsDataDirty = true
    let getInfoParams = {
        TableName : process.env.INFO_TABLE,
        Key: {
            key: infoKey
        }
    }
    await docClient.get(getInfoParams).promise().then((response) => {
        isResultsDataDirty = response.Item === undefined || response.Item.isResultsDataDirty
    }).catch((error) => {
        throw error
    })

    if (isResultsDataDirty) {
        allResults = await scanResults()

        let putBucketParams = {
            Bucket: process.env.CACHE_BUCKET,
            Key: cachedDataName,
            Body: JSON.stringify(allResults)
        }

        await s3Client.send(new PutObjectCommand(putBucketParams)).catch((error) => {
            throw error
        })

        await setIsResultsDataDirty(false)
    } else {
        let getBucketParams = {
            Bucket: process.env.CACHE_BUCKET,
            Key: cachedDataName
        }
        allResults = await s3Client.send(new GetObjectCommand(getBucketParams)).then((response) => {
            return streamToString(response.Body)
        }).then((dataString) => {
            return allResults = JSON.parse(dataString)
        }).catch((error) => {
            throw error
        })
    }

    return allResults
}

async function scanResults() {
    let allResults = {}

    let scanParams = {
        TableName : process.env.POINTS_MANIFEST_TABLE
    }
    let items
    do {
        items = await docClient.scan(scanParams).promise().catch((error) => {
            throw error
        })
        for (let result of items.Items) {
            allResults[result.key] = result
        }

        scanParams.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey !== undefined)

    return allResults
}

async function setIsResultsDataDirty(isDirty) {
    let putInfoParams = {
        TableName : process.env.INFO_TABLE,
        Item: {
            key: infoKey,
            isResultsDataDirty: isDirty
        }
    }
    await docClient.put(putInfoParams).promise().catch((error) => {
        throw error
    })
}

const streamToString = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = []
        stream.on("data", (chunk) => chunks.push(chunk))
        stream.on("error", reject)
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
})
