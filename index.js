const express = require('express');
const http = require('http');
const app = express();
const formidable = require('formidable');
const fs = require('fs');
const { check } = require('express-validator');
const expressSanitizer = require('express-sanitizer');
const webSocket = require('ws');

const apiPort = 4000;
const socketPort = 4001;


let socketList = [];
let guestList = [];

function broadcast(message) {
    socketList.forEach(element => {
        element.send(message)
    });
}

function addGuest(guest) {
    guestList.push(guest);
    let content = JSON.stringify(guestList);
    fs.writeFile(__dirname + '/guests.json', content, err => {
        if (err) {
            console.error(err);
        }
        // file written successfully
    });
    broadcast("GUEST_UPDATE");
}

function sanitize(str) {
    str = str.replaceAll('[', '').replaceAll(']', '').replaceAll('"', '').replaceAll('<', '').replaceAll('>', '').replaceAll('{', '').replaceAll('}', '');
    return str;

}
var server = http.createServer(app).listen(apiPort, function() {
    console.log("Express server listening on port " + apiPort);
    guestList = require('./guests.json');
});
app.post('/submit', [
    check('name').isLength({ min: 1 }).trim().escape(),
    check('subject').isLength({ min: 1 }).trim().escape(),
    check('text').isLength({ min: 1 }).trim().escape(),

], function(req, res) {
    var form = new formidable.IncomingForm()
    fields = new Map();
    form
        .on('field', function(field, value) {
            fields.set(field, value);
        }).parse(req, async function() {
            let guest = {
                "name": null,
                "subject": null,
                "text": null,
                "verified": false
            };

            try {
                guest.name = sanitize(fields.get('name'));
                guest.subject = sanitize(fields.get("subject"));
                guest.text = sanitize(fields.get("text"));
            } catch (ex) {
                console.log(ex);
            };
            if (guest.name == null || guest.subject == null || guest.text == null ||
                guest.name == "" || guest.subject == "" || guest.text == "") {
                res.writeHead(400);
                res.end();
            } else {
                addGuest(guest);
                res.redirect('/');
                res.end();
            }




        });


});
app.get('/list', function(req, res) {
    let response = "";
    guestList.forEach(guest => {
        response += '<div class="mb-3">';
        if (guest.verified) response += '<img src="verified.png" height="16px" width="16px" style="margin: 4px;">';
        response += '<label style = "vertical-align: center;"><b>[' + guest.name + ']:</b> ' + guest.subject + '</label><br>' +
            guest.text + '</div><hr>';
    });
    if (response != "") response = response.slice(0, -4);
    else
        response = '<div class="mb-3"><label>Brak wpisów</label><div>';
    res.writeHead(200);
    res.end(response);

});



const wss = new webSocket.Server({ port: socketPort });
wss.on("connection", ws => {
    socketList.push(ws);
    broadcast(socketList.length);


    ws.on("close", () => {
        for (var i = 0; i < socketList.length; i++) {

            if (socketList[i] === ws) {
                socketList.splice(i, 1);
                i--;
            }
        }
        broadcast(socketList.length);
    })
});