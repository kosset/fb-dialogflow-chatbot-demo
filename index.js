'use strict';

// Imports dependencies and set up http server
const express = require('express'),
    bodyParser = require('body-parser'),
    config = require('config'),
    request = require('request'),
    apiai = require('apiai'),
    app = express().use(bodyParser.json()); // creates express http server

// Configurations
const PORT = config.get('port') || 3000;
const PAGE_ACCESS_TOKEN = config.get('facebook.page_access_token');
const VERIFY_TOKEN = config.get('facebook.verify_token');
const APIAI_CLIENT_ACCESS_TOKEN = config.get('dialogflow.client_access_token');

// Sets server port and logs message on success
app.listen(PORT, () => console.log('Webhook is listening on port ' + PORT));


app.get('/', (req, res)=> {

    let api_resources = {
        "info": "Backend server for messenger chatbot implementation",
        "meta": {
            "links": {
                "self": "https:/"+ req.headers.host +"/",
                "fb_webwook": "https://"+ req.headers.host +"/fb_webhook"
            }
        }
    };

    // Print links
    res.status(200).json(api_resources);
});

// Adds support for GET requests to our webhook
// Used when a page gets subscribed to our app
app.get('/fb_webhook', (req, res) => {

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// Creates the endpoint for our webhook
app.post('/fb_webhook', (req, res) => {

    // Parse the request body from the POST
    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {

            // Gets the message. entry.messaging is an array, but
            // will only ever contain one message, so we get index 0
            let webhookEvent = entry.messaging[0];
            // console.log(webhookEvent);

            // Get the sender PSID
            let sender_psid = webhookEvent.sender.id;
            // console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhookEvent.message && webhookEvent.message.text) {
                console.log("User with PSID: %s said '%s'", sender_psid, webhookEvent.message.text);
                sendUserInput2Dialogflow(sender_psid, webhookEvent.message.text);
            }

        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {

    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    };

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log("The bot responded '%s'", response.text);
        } else {
            console.error("Unable to send message:" + err);
        }
    });

}

// Sends user's text to dialogflow for intent detection
function sendUserInput2Dialogflow(sender, text) {

    if (APIAI_CLIENT_ACCESS_TOKEN) {
        let apiaiClient = apiai(APIAI_CLIENT_ACCESS_TOKEN);

        let apiaiRequest = apiaiRequestClient.textRequest(text, {
            sessionId: sender // use any arbitrary id
        });
    
        apiaiRequest.on('response', (response) => {
            let aiText = response.result.fulfillment.speech;
            let fbResponse = {text: aiText};
    
            // Send speech to fb
            callSendAPI(sender, fbResponse);
        });
    
        apiaiRequest.on('error', (error) => {
            console.log(error);
        });
    
        apiaiRequest.end();

    } else {
        let fbResponse = {text: "You said: " + text};
        
        // Send speech to fb
        callSendAPI(sender, fbResponse);
    }
}