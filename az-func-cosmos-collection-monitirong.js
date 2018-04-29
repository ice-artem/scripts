var DocumentDBClient = require('documentdb').DocumentClient
var crypto = require("crypto");
var moment = require("moment");
var util = require('util');
const sendgrid = require('@sendgrid/mail');
sendgrid.setApiKey('YOUR_SENDGRID_API_KEY');
const got = require('got');

const host = 'https://your_azure_host.documents.azure.com';
const masterKey = "YOUR_AZURE_MASTER_KEY";

// Establish a new instance of the DocumentDBClient to be used throughout this demo
var client = new DocumentDBClient(host, { masterKey: masterKey });

module.exports = function (context, myTimer) {
    var timeStamp = new Date().toISOString();
    
    if(myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }
    context.log('JavaScript timer trigger function ran!', timeStamp);

    let dateInRfc7231Format = moment().utc().format("ddd, DD MMM YYYY HH:mm:ss");
    let dateWithTimeZone = dateInRfc7231Format + " GMT";

    listDatabases(function (dbs) {
        for (var i = 0; i < dbs.length; i++) {
        const dbLink = 'dbs/' + dbs[i].id;
            listCollections(dbLink, function (cols) {
                    for (var i = 0; i < cols.length; i++) {
                        const collection = dbLink + '/colls/'+ cols[i].id;
                        const result = getAuthorizationTokenUsingMasterKey("GET", collection, "colls", dateWithTimeZone, masterKey);
                        got(util.format("%s/%s", host, collection), {
                            headers: {
                                'Authorization': result,
                                'x-ms-version': '2017-02-22',
                                'x-ms-date': dateWithTimeZone
                            }
                        })
                        .then(response => {
                            const usage = (response.headers['x-ms-resource-usage'].match(/collectionSize=(\d{1,})/i)[1]);
                            const quota = (response.headers['x-ms-resource-quota'].match(/collectionSize=(\d{1,})/i)[1]);
                            if (usage > quota*0.9){
                                const email = {
                                    to: 'alerts@your_mail.com',
                                    from: 'from_who@mail.com',
                                    subject: '[ACHTUNG]Quota Alarm!',
                                    text: util.format("%s/%s Collection quota almost exceeded and reached %d\%", host, collection, Math.floor((usage / quota) * 100))
                                };
                                sendgrid.send(email);
                            }
                        })
                        .catch(error => {
                            context.log(error.response.body);
                        });
                    }
            });
        }
    });

    var getAuthorizationTokenUsingMasterKey = function (verb, resourceId, resourceType, date, masterKey) {  
        var key = new Buffer(masterKey, "base64");  

        var text = (verb || "").toLowerCase() + "\n" +   
                   (resourceType || "").toLowerCase() + "\n" +   
                   (resourceId || "") + "\n" +   
                   (date || "").toLowerCase() + "\n" +   
                   "" + "\n";

        var body = new Buffer(text, "utf8");  
        var signature = crypto.createHmac("sha256", key).update(body).digest("base64");
        var MasterToken = "master";  
        var TokenVersion = "1.0";  

        return encodeURIComponent("type=" + MasterToken + "&ver=" + TokenVersion + "&sig=" + signature);
    }

    function listDatabases(callback) {
        var queryIterator = client.readDatabases().toArray(function (err, dbs) {
            if (err) {
                handleError(err);
            }
            callback(dbs);
        });
    }

    function listCollections(databaseLink, callback) {
        var queryIterator = client.readCollections(databaseLink).toArray(function (err, cols) {
            if (err) {
                handleError(err);
            } else {            
                callback(cols);
            }
        });
    }

    context.done();
}

