/* jshint ignore:start */
/* eslint-disable */

/* Original QUnit test: https://github.com/cowboy/jquery-throttle-debounce/blob/master/unit/unit.js */

var module = require('qunitjs').module;
var test = require('qunitjs').test;
var expect = require('qunitjs').expect;
var ok = require('qunitjs').ok;
var equals = require('qunitjs').equal;
var start = require('qunitjs').start;
var stop = require('qunitjs').stop;

var throttle = require('../throttle');
var debounce = require('../debounce');

QUnit.config.autostart = false;

var pause = 500,
	delay = 100;

function exec_many_times( each, complete ) {
	var i = 0,
		repeated,
		id;

	function start(){
		id = setInterval(function(){
			each();
			if ( ++i === 50 ) {
				clearInterval( id );
				complete( repeated ? null : function(){
					i = 0;
					repeated = true;
					setTimeout( start, pause );
				});
			}
		}, 20);
	}

	setTimeout( start, pause );
};

module( 'throttle' );

test( 'delay, callback', function() {
	expect( 7 );
	stop();

	var start_time,
		i = 0,
		arr = [],
		fn = function( now ){
			arr.push( now - this )
		},
		throttled = throttle( delay, fn );

	equals( throttled.guid, fn.guid, 'throttled-callback and callback should have the same .guid' );

	exec_many_times( function(){
		var now = +new Date();
		start_time = start_time || now;
		i++;
		throttled.call( start_time, now );
	}, function( callback ){
		var len = arr.length;

		setTimeout(function(){
			//console.log( arr, arr.length, len, i );
			ok( arr.length < i, 'callback should be executed less # of times than throttled-callback' );
			equals( arr[0], 0, 'callback should be executed immediately' );
			equals( arr.length - len, 1, 'callback should be executed one more time after finish' );

			start_time = null;
			arr = [];
			i = 0;

			callback ? callback() : start();

		}, delay * 2);
	})
});

test( 'delay, false, callback', function() {
	expect( 7 );
	stop();

	var start_time,
		i = 0,
		arr = [],
		fn = function( now ){
			arr.push( now - this )
		},
		throttled = throttle( delay, false, fn );

	equals( throttled.guid, fn.guid, 'throttled-callback and callback should have the same .guid' );

	exec_many_times( function(){
		var now = +new Date();
		start_time = start_time || now;
		i++;
		throttled.call( start_time, now );
	}, function( callback ){
		var len = arr.length;

		setTimeout(function(){
			//console.log( arr, arr.length, len, i );
			ok( arr.length < i, 'callback should be executed less # of times than throttled-callback' );
			equals( arr[0], 0, 'callback should be executed immediately' );
			equals( arr.length - len, 1, 'callback should be executed one more time after finish' );

			start_time = null;
			arr = [];
			i = 0;

			callback ? callback() : start();

		}, delay * 2);
	})
});

test( 'delay, true, callback', function() {
	expect( 7 );
	stop();

	var start_time,
		i = 0,
		arr = [],
		fn = function( now ){
			arr.push( now - this )
		},
		throttled = throttle( delay, true, fn );

	equals( throttled.guid, fn.guid, 'throttled-callback and callback should have the same .guid' );

	exec_many_times( function(){
		var now = +new Date();
		start_time = start_time || now;
		i++;
		throttled.call( start_time, now );
	}, function( callback ){
		var len = arr.length;

		setTimeout(function(){
			//console.log( arr, arr.length, len, i );
			ok( arr.length < i, 'callback should be executed less # of times than throttled-callback' );
			equals( arr[0], 0, 'callback should be executed immediately' );
			equals( arr.length - len, 0, 'callback should NOT be executed one more time after finish' );

			start_time = null;
			arr = [];
			i = 0;

			callback ? callback() : start();

		}, delay * 2);
	})
});


module( 'debounce' );

test( 'delay, callback', function() {
	expect( 5 );
	stop();

	var start_time,
		i = 0,
		arr = [],
		fn = function(){
			arr.push( +new Date() )
		},
		debounced = debounce( delay, fn );

	equals( debounced.guid, fn.guid, 'throttled-callback and callback should have the same .guid' );

	exec_many_times( function(){
		start_time = start_time || +new Date();
		i++;
		debounced.call();
	}, function( callback ){
		var len = arr.length,
			done_time = +new Date();

		setTimeout(function(){
			//console.log( arr[0] - done_time );
			equals( arr.length, 1, 'callback was executed once' );
			ok( arr[0] >= done_time, 'callback should be executed after the finish' );

			start_time = null;
			arr = [];
			i = 0;

			callback ? callback() : start();

		}, delay * 2);
	})
});

test( 'delay, false, callback', function() {
	expect( 5 );
	stop();

	var start_time,
		i = 0,
		arr = [],
		fn = function(){
			arr.push( +new Date() )
		},
		debounced = debounce( delay, false, fn );

	equals( debounced.guid, fn.guid, 'throttled-callback and callback should have the same .guid' );

	exec_many_times( function(){
		start_time = start_time || +new Date();
		i++;
		debounced.call();
	}, function( callback ){
		var len = arr.length,
			done_time = +new Date();

		setTimeout(function(){
			//console.log( arr[0] - done_time );
			equals( arr.length, 1, 'callback was executed once' );
			ok( arr[0] >= done_time, 'callback should be executed after the finish' );

			start_time = null;
			arr = [];
			i = 0;

			callback ? callback() : start();

		}, delay * 2);
	})
});

test( 'delay, true, callback', function() {
	expect( 5 );
	stop();

	var start_time,
		i = 0,
		arr = [],
		fn = function(){
			arr.push( +new Date() )
		},
		debounced = debounce( delay, true, fn );

	equals( debounced.guid, fn.guid, 'throttled-callback and callback should have the same .guid' );

	exec_many_times( function(){
		start_time = start_time || +new Date();
		i++;
		debounced.call();
	}, function( callback ){
		var len = arr.length;

		setTimeout(function(){
			//console.log( arr[0] - start_time );
			equals( arr.length, 1, 'callback was executed once' );
			ok( arr[0] - start_time <= 5, 'callback should be executed at the start' );

			start_time = null;
			arr = [];
			i = 0;

			callback ? callback() : start();

		}, delay * 2);
	})
});
