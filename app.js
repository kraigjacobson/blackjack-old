'use strict';

[
    ['warn', '\x1b[33m'],
    ['error', '\x1b[31m'],
    ['info', '\x1b[35m'],
    ['log', '\x1b[2m']
].forEach((pair) => {
    let method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
    console[method] = console[method].bind(console, color, method.toUpperCase(), reset);
});

process.on('uncaughtException', (err) => {
    console.error(new Date(), 'Uncaught Exception:', err.stack ? err.stack : err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error(new Date(), 'Unhandled Rejection:', err.stack ? err.stack : err);
    process.exit(1);
});

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const request = require('request');
const validator = require('validator');
const sockets = require('./src/sockets');

app.use(express.static('html'));

let fullDeck = ['AS', 'KS', 'QS', 'JS', '10S', '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S',
    'AH', 'KH', 'QH', 'JH', '10H', '9H', '8H', '7H', '6H', '5H', '4H', '3H', '2H',
    'AD', 'KD', 'QD', 'JD', '10D', '9D', '8D', '7D', '6D', '5D', '4D', '3D', '2D',
    'AC', 'KC', 'QC', 'JC', '10C', '9C', '8C', '7C', '6C', '5C', '4C', '3C', '2C'];

function Game() {

    this.currentDeck = fullDeck.slice(0);
    this.users = {};

    this.public = {
        table: [],
        waitingList: [],
        dealer: {
            cards: null
        },
        tableMax: 5,
        cardCount: 0,
    };

    this.private = {
        roundInProgress: false,
        turn: null,
        dealer: {
            card: null
        },
        cardHidden: true,
    };

    this.nextTurn = function (seatNumber, users) {
        console.log('users',users);
        let numberOfPlayers = function () {
            let count = 0;
            for (let i=0;i<game.public.table.length;i++) {
                if (game.public.table[i]){
                    count++;
                }
            }
            return count;
        };
        if (seatNumber + 1 < numberOfPlayers()) {
            this.private.turn = seatNumber + 1;
            for (let i = seatNumber + 1; i < game.public.table.length; i++) {
                if (game.public.table[i]) {
                    console.log('newseat',game.public.table[i].seat);
                    io.emit('highlightPlayer', game.public.table[i].seat);

                    // socket.emit('buttons', {ready: false, hit: true, stay: true, double: true, split: false});
                    break;
                }
            }
            console.log(this.private.turn);
        } else {
            this.private.turn = 'Dealer';
            // flip hidden card
            game.public.dealer.cards.push(game.private.dealer.card[0]);
            game.public.dealer.cardCount = game.countCards(game.public.dealer.cards);
            while (game.public.dealer.cardCount < 17) {
                if (game.public.dealer.cardCount > 21) {
                    socket.emit('newmsg', {message: 'Dealer Busted!', user: 'Server'});
                }
                game.public.dealer.cards.push(game.getCards(1)[0]);
                game.public.dealer.cardCount = game.countCards(game.public.dealer.cards);
            }
            io.emit('buttons', {ready: true, hit: false, stay: false, double: false, split: false});
            io.emit('refreshGame', game.public);
        }
        console.log('this.private.turn', this.private.turn);
    };

    this.countCards = function (cardArray) {
        console.log(cardArray);
        let cardCount = 0;
        for (let j = 0; j < cardArray.length; j++) {
            let card = cardArray[j];
            if (card.includes('K') || card.includes('Q') || card.includes('J')) {
                cardCount += 10;
            } else if (card.includes('A')) {
                if (cardCount + 11 > 21) {
                    cardCount += 1;
                } else {
                    cardCount += 11;
                }
            } else {
                let numberPattern = /\d+/g;
                cardCount += parseInt(card.match(numberPattern));
            }
        }
        return cardCount;
    };

    this.getCards = function (number) {
        let cards = [];
        for (let i = 0; i < number; i++) {
            let card = game.currentDeck.splice([Math.floor(Math.random() * game.currentDeck.length)], 1);
            cards.push(card[0]);
        }
        return cards;
    };

    this.readyCheck = function () {
        let sockets = Object.keys(io.sockets.sockets);
        let ready = [];
        let waitingOn = [];
        for (let r = 0; r < sockets.length; r++) {
            let socket = io.sockets.connected[sockets[r]];
            console.log(socket.user.ready);
            if (socket.user.ready) {
                ready.push(socket.user.name);
            } else {
                waitingOn.push(socket.user.name);
            }
        }
        // for (let socket in sockets) {
        //     console.log('socket',socket);
        //     let socket = sockets[socketId];
        //     console.log('socketuser',socket.user);
        //     if (socket.user.ready===true) {
        //         ready.push(socket.user.name);
        //     } else {
        //         waitingOn.push(socket.user.name);
        //     }
        // }
        if (sockets.length === ready.length) {
            return {status: "ready"};
        } else {
            return {status: "waiting", waitingOn}
        }
    };

    this.checkDeckLength = function () {
        if (game.currentDeck.length < 15) {
            game.currentDeck = fullDeck.slice(0);
        }
    };
}

const game = new Game();

io.use(function (socket, next) {
    let data = socket.handshake.query;
    // request({
    //     uri: "https://www.google.com/recaptcha/api/siteverify",
    //     method: "POST",
    //     form: {
    //         secret: '6LcaWiwUAAAAAE8S0J_JgIR6nq4j2bvi35Q_Aq2E',
    //         response: data.gtoken
    //     }
    // }, function(error, response, body) {
    //     let json = JSON.parse(body);
    //     if(!json || !json.success) {
    //         next({message: 'Invalid gtoken.'});
    //     }
    // });

    let name = decodeURI(data.name);

    if (!name) {
        next({
            message: 'Please enter a username.'
        });
    } else {
        if (name.length > 10) {
            next({
                message: 'Username must be 10 characters or less.'
            });
        } else {
            // user successfully connected

            socket.user = {
                name: name,
                cards: [],
                ready: false,
                money: 100,
                seat: null
            };
            next();
        }
    }
});

sockets(game, io);

http.listen(3009, function () {
    console.log(`listening on *:3009`);
});