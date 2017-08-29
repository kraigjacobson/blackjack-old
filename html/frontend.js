'use script';

var thingy = {};
var socket = null;

$(function () {
    $('#game').hide();
    $('#name').focus();
    thingy.setUsername = function () {
        event.preventDefault();
        var gtoken = $('#g-recaptcha-response').val();
        var name = encodeURI(document.getElementById('name').value);
        if (gtoken) {
            init(name, gtoken);
        } else {
            init(name, null);
//only for testing
//                alert('check the box. and do the stuff!');
        }
    };

    var game = null;
    var user = null;

    function init(name, gtoken) {
        socket = io(window.href, {query: 'name=' + name + '&gtoken=' + gtoken});

        socket.on('connect_error');

        socket.on('userExists', function (data) {
            document.getElementById('error-container').innerHTML = data;
        });

        socket.on('userSet', function () {
            $('#signin').hide();
            $('#game').show();
            $('#message').focus();
        });

        socket.on('refreshUser', function (data) {
            user = data;
        });

        thingy.sendMessage = function (event) {
            event.preventDefault();
            var msg = document.getElementById('message').value;
            if (msg) {
                socket.emit('msg', msg);
                document.getElementById('message').value = '';
            }
        };

        thingy.readyCheck = function (event) {
            event.preventDefault();
            socket.emit('requestDeal');
            $('#ready').hide();
            socket.turn = false;
        };

        thingy.hit = function (event) {
            event.preventDefault();
            console.log('socket',socket);
            socket.emit('hit', user);
        };

        thingy.stay = function (event) {
            event.preventDefault();
            socket.emit('stay', user);
        };

        socket.on('buttons', function (data) {

            if (data.ready) {
                $('#ready').show();
            } else {
                $('#ready').hide();
            }
            if (data.hit) {
                $('#hit').show();
            } else {
                $('#hit').hide();
            }
            if (data.stay) {
                $('#stay').show();
            } else {
                $('#stay').hide();
            }
            if (data.double) {
                $('#double').show();
            } else {
                $('#double').hide();
            }
            if (data.split) {
                $('#split').show();
            } else {
                $('#split').hide();
            }

        });

        socket.on('highlightPlayer', function (seatNumber) {
            $('.player').css("background-color", "transparent");
            $('#p' + seatNumber).css("background-color", "#c1f6a2");
            console.log(seatNumber);
            console.log(user);
            if (seatNumber === user.seat) {
                $('#p' + seatNumber).css("background-color", "#9acd7f");
            } else {
                $('body').css("background-color", "#fff");
            }
        });

        socket.on('newmsg', function (data) {
            document.getElementById('message-container').innerHTML += '<div><b>' + data.user + '</b>: ' + data.message + '</div>'
        });

        socket.on('refreshGame', function (data) {
            console.log('daaata',data);
            // update players
            for (i = 0; i < data.table.length; i++) {
                document.getElementById('p' + i).innerHTML = '';
                var player = data.table[i];
                console.log(data.table);
                // if (player.turn) {
                //     $('#p' + i).css("background-color", "#5cb85c");
                // } else {
                //     $('#p' + i).css("background-color", "inherit");
                // }
                if (player) {
                    var readiness = player.ready === false ? "Waiting" : "Ready";

                    document.getElementById('p' + i).innerHTML += '<div class="player-name">' + player.name + ' <div class="float-right">$' + player.money + ' </div></div><div class="float-right">' + readiness + ' ' + '</div>';
                    for (j = 0; j < player.cards.length; j++) {
                        var card = player.cards[j];
                        document.getElementById('p' + i).innerHTML += '<span>' + card + ' </span>';
                    }
                    if (data.table[i].cardCount) {
                        document.getElementById('p' + i).innerHTML += '<div>Total: ' + player.cardCount + '</div>';
                    }
                }
            }

            //update dealer
            document.getElementById('dealer').innerHTML = '<div class="player-name">Dealer</div>';

            if (data.dealer.cardCount) {
                for (d = 0; d < data.dealer.cards.length; d++) {
                    var card = player.cards[d];
                    document.getElementById('dealer').innerHTML += '<span>' + card  + ' </span>';
                }
                document.getElementById('dealer').innerHTML += '<div class="pull-right">Total: ' + data.dealer.cardCount + '</div>';
            }
            document.getElementById('waitinglist-container').innerHTML = '';

            for (i = 0; i < data.waitingList.length; i++) {
                if (data.waitingList[i] != null) {
                    var user = data.waitingList[i];
                    document.getElementById('waitinglist-container').innerHTML += '<div>' + user.name + '</div>';
                }
            }
        });
    }
});