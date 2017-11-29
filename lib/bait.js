'use strict';

var Bluebird = require('bluebird');
var _ = require('lodash');

var Bait = {
    /**
     * [hook Sets up monkey-patching for a method of an object.
     * From this point all calls to this method will be proxied through our own function (newFn).
     * This newFn function will add the original function at the end of a promise chain.
     * And will give you the ability to register other functions at the start or end of this promise chain.]
     * @param  {Object}   obj [context of your function]
     * @param  {Function} fn  [the name of the function you want to hook to]
     * @param  {Function} errorHandler where to send error details for issues in later hooks
     */
    hook: function(obj, fn, errorHandler){
        if (obj[fn].__hooked) return;

        // the array of functions running before fn
        obj['pre' + fn + 'hooks'] = [];

        // the array of functions running after fn
        obj['post' + fn + 'hooks'] = [];

        // the array of functions running after fn
        obj['later' + fn + 'hooks'] = [];

        // save a copy of the original function
        obj['original'+fn] = obj[fn];

        // our new method
        var newFn = function(){
            var self = this;

            // the chain of promises
            var promiseArray = _.flatten([self['pre' + fn + 'hooks'], self['original'+fn], self['post' + fn + 'hooks']]);
            var laterArray = self['later' + fn + 'hooks']

            // transform hook functions to return promises if they weren't doing that before
            promiseArray = promiseArray.map(Bluebird.method);

            // the starting value for the chain. is the original parameter to the monkeypatched method
            var startingArgs = Bluebird.resolve.apply(self, arguments);

            return promiseArray.reduce(function(prev, curr) {
                // call the current fn with the previous fn's return value
                // and returns that as a promise
                return prev.then(function(result) {
                    return curr.bind(self)(result);
                });
            }, startingArgs)
            .tap(function(args){
                laterArray.reduce(function(prev, curr) {
                    // call the current fn with the previous fn's return value
                    // and returns that as a promise
                    return prev.then(function(result) {
                        return curr.bind(self)(result);
                    });
                }, args))
                .then(function(){ return null;})
                .catch(errorHandler);
            });
        };

        // redifine the original method
        obj[fn] = newFn;
        obj[fn].__hooked = true;
    },

    pre: function(obj, fn, callbackFn){
        this.hook(obj, fn);
        obj['pre' + fn + 'hooks'].push(callbackFn);
    },

    post: function(obj, fn, callbackFn){
        this.hook(obj, fn);
        obj['post' + fn + 'hooks'].push(callbackFn);
    },

    later: function(obj, fn, callbackFn){
        this.hook(obj, fn);
        obj['later' + fn + 'hooks'].push(callbackFn);
    },

    orig: function(obj, fn){
        if (!obj[fn].__hooked) return obj[fn];
        return obj['original' + fn];
    }

};

module.exports = Bait;
