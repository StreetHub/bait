'use strict';

var _ = require('lodash');
var chai = require('chai');
chai.should();

var Bluebird = require('bluebird');
var Bait = require('../');

// define some global objects we will reset for every test
var testObj = {};
var testMethods = {};

// save function call order
var callOrder = [];

// define our custom error type
function CustomError(message) {
  this.name = "CustomError";
  this.message = message || "Default Custom Error Message";
  Error.captureStackTrace(this, CustomError);
}
CustomError.prototype = new Error();
CustomError.prototype.constructor = CustomError;


describe('Bluebird-hooks (aka bait)', function() {

    beforeEach(function(){
        // reset the call history
        callOrder = [];

        // reset our obj
        testObj = {
            // the method to be augmented
            method: function(opts){
                testObj.methodArgs = Array.prototype.slice.call(arguments, 0);
                testObj.methodCalled++;
                callOrder.push('method');
                // console.log('method', opts);

                return Bluebird.resolve(testObj.methodReturnValue);
            },
            methodCalled: 0,
            methodArgs: [],
            methodReturnValue: 'method',
        };

        // use the following functions as pre and post hooks
        testMethods = {
            // this one is not even a promise ;) simply returns
            test1: function(opts){
                testMethods.test1Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test1Called++;
                callOrder.push('test1');
                // console.log('test1', opts);

                return 'test1';
            },
            test1Called: 0,
            test1Args: [],
            test1ReturnValue: 'test1',

            test2: function(opts){
                testMethods.test2Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test2Called++;
                callOrder.push('test2');
                // console.log('test2', opts);

                return Bluebird.resolve(testMethods.test2ReturnValue);
            },
            test2Called: 0,
            test2Args: [],
            test2ReturnValue: {test2: 'test2'},

            test3: function(opts){
                testMethods.test3Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test3Called++;
                callOrder.push('test3');
                // console.log('test3', opts);

                // extending the incoming parameters, deep copy to keep the tests sane and don't touch the arguments obj
                var newOpts = _.cloneDeep(opts);
                newOpts.test3 = 'test3';
                return Bluebird.resolve(newOpts);
            },
            test3Called: 0,
            test3Args: [],

            test4: function(opts){
                testMethods.test4Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test4Called++;
                callOrder.push('test4');
                // console.log('test4', opts);

                // extending the incoming parameters, deep copy to keep the tests sane and don't touch the arguments obj
                var newOpts = _.cloneDeep(opts);
                newOpts.test4 = 'test4';
                return new Bluebird(function(resolve){
                    setTimeout(function(){
                        resolve(newOpts);
                    }, 3);
                });
            },
            test4Called: 0,
            test4Args: [],

            // error cases:
            // this one always rejects
            test5: function(opts){
                testMethods.test5Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test5Called++;
                callOrder.push('test5');
                // console.log('test5', opts);

                return new Bluebird.reject(testMethods.test5ReturnValue);
            },
            test5Called: 0,
            test5Args: [],
            test5ReturnValue: new Error('test5'),

            // this one always throws an error
            test6: function(opts){
                testMethods.test6Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test6Called++;
                callOrder.push('test6');
                // console.log('test6', opts);

                throw new Error('test6');
            },
            test6Called: 0,
            test6Args: [],

            // this one always throws an error inside it's promise
            test7: function(opts){
                testMethods.test7Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test7Called++;
                callOrder.push('test7');
                // console.log('test7', opts);
                return new Bluebird(function(){
                    throw new Error('test7');
                });
            },
            test7Called: 0,
            test7Args: [],

            // this one always throws a custom error
            test8: function(opts){
                testMethods.test8Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test8Called++;
                callOrder.push('test8');
                // console.log('test8', opts);

                throw new CustomError('test8');
            },
            test8Called: 0,
            test8Args: [],

            // this one rejects asynchronously
            test9: function(opts){
                testMethods.test9Args = Array.prototype.slice.call(arguments, 0);
                testMethods.test9Called++;
                callOrder.push('test9');
                // console.log('test9', opts);

                return new Bluebird(function(resolve, reject){
                    setTimeout(function(){
                        reject('test9');
                    }, 3);
                });
            },
            test9Called: 0,
            test9Args: [],
        };
    });


    describe('test call history', function() {
        it('should call method and save the call history', function(done) {
            callOrder.should.be.eql([]);
            testObj.method('hi').then(function(result){
                result.should.eql('method');
                callOrder.should.be.eql(['method']);
                done();
            }).catch(done);
        });

        it('should reset call history between tests', function(done) {
            callOrder.should.be.eql([]);
            testObj.method('hi').then(function(result){
                result.should.eql('method');
                callOrder.should.be.eql(['method']);
                done();
            }).catch(done);
        });
    });

    describe('hook', function() {
        it('should add pre and post fn arrays to the object', function() {
            testObj.should.not.have.property('premethodhooks');
            testObj.should.not.have.property('postmethodhooks');
            Bait.hook(testObj, 'method');
            testObj.should.have.property('premethodhooks').that.is.an('array');
            testObj.should.have.property('postmethodhooks').that.is.an('array');
        });

        it('should save the original function to the object', function() {
            testObj.should.not.have.property('originalmethod');
            Bait.hook(testObj, 'method');
            testObj.should.have.property('originalmethod').that.is.a('function');
        });

        it('should patch the function and add a flag', function() {
            testObj.method.should.not.have.property('__hooked');
            Bait.hook(testObj, 'method');
            testObj.method.should.have.property('__hooked');
        });
    });

    describe('pre hooking', function() {
        it('should patch the function', function() {
            testObj.method.should.not.have.property('__hooked');
            Bait.pre(testObj, 'method', testMethods.test1);
            testObj.method.should.have.property('__hooked');
        });

        it('should patch the function only once', function() {
            testObj.method.should.not.have.property('__hooked');
            Bait.pre(testObj, 'method', testMethods.test1);
            testObj.should.have.property('premethodhooks').that.is.an('array');
            testObj.premethodhooks.should.have.length(1);
            Bait.pre(testObj, 'method', testMethods.test2);
            testObj.premethodhooks.should.have.length(2);
            testObj.premethodhooks[0].should.eql(testMethods.test1);
            testObj.premethodhooks[1].should.eql(testMethods.test2);
        });
    });

    describe('post hooking', function() {
        it('should patch the function', function() {
            testObj.method.should.not.have.property('__hooked');
            Bait.post(testObj, 'method', testMethods.test1);
            testObj.method.should.have.property('__hooked');
        });

        it('should patch the function only once', function() {
            testObj.method.should.not.have.property('__hooked');
            Bait.post(testObj, 'method', testMethods.test1);
            testObj.should.have.property('postmethodhooks').that.is.an('array');
            testObj.postmethodhooks.should.have.length(1);
            Bait.post(testObj, 'method', testMethods.test2);
            testObj.postmethodhooks.should.have.length(2);
            testObj.postmethodhooks[0].should.eql(testMethods.test1);
            testObj.postmethodhooks[1].should.eql(testMethods.test2);
        });
    });

    describe('pre calling', function() {

        it('should call the pre functions first (in the right order) when you call the method ', function(done) {
            Bait.pre(testObj, 'method', testMethods.test1);
            Bait.pre(testObj, 'method', testMethods.test2);
            Bait.pre(testObj, 'method', testMethods.test3);
            Bait.pre(testObj, 'method', testMethods.test4);

            testObj.method('hi').then(function(result){
                result.should.eql('method');
                callOrder.should.be.eql(['test1', 'test2', 'test3', 'test4', 'method']);
            }).then(function(){
                // call it again
                return testObj.method('hi');
            }).then(function(result){
                result.should.eql('method');
                callOrder.should.be.eql(['test1', 'test2', 'test3', 'test4', 'method', 'test1', 'test2', 'test3', 'test4', 'method']);
                done();
            }).catch(done);
        });

        it('should pass onward the return values through the chain as arguments for the next hook/method', function(done) {
            Bait.pre(testObj, 'method', testMethods.test2);
            Bait.pre(testObj, 'method', testMethods.test4);
            testObj.method('hi').then(function(result){
                result.should.eql('method');
                testMethods.test2Args.should.eql(['hi']);
                testMethods.test4Args.should.eql([{test2: 'test2'}]);
                testObj.methodArgs.should.eql([{test2: 'test2', test4: 'test4'}]);
                done();
            }).catch(done);
        });
    });

    describe('post calling', function() {

        it('should call the post functions after (in the right order) the method', function(done) {
            Bait.post(testObj, 'method', testMethods.test1);
            Bait.post(testObj, 'method', testMethods.test2);
            Bait.post(testObj, 'method', testMethods.test3);
            Bait.post(testObj, 'method', testMethods.test4);

            testObj.method('hi').then(function(result){
                result.should.eql({test2: 'test2', test3: 'test3', test4: 'test4'});
                callOrder.should.be.eql(['method', 'test1', 'test2', 'test3', 'test4']);
            }).then(function(){
                // call it again
                return testObj.method('hi');
            }).then(function(result){
                result.should.eql({test2: 'test2', test3: 'test3', test4: 'test4'});
                callOrder.should.be.eql(['method', 'test1', 'test2', 'test3', 'test4', 'method', 'test1', 'test2', 'test3', 'test4']);
                done();
            }).catch(done);
        });

        it('should pass onward the return values through the chain as arguments for the next hook/method', function(done) {
            Bait.post(testObj, 'method', testMethods.test2);
            Bait.post(testObj, 'method', testMethods.test4);
            testObj.method('hi').then(function(result){
                testObj.methodArgs.should.eql(['hi']);
                testMethods.test2Args.should.eql(['method']);
                testMethods.test4Args.should.eql([{test2: 'test2'}]);
                result.should.eql({test2: 'test2', test4: 'test4'});
                done();
            }).catch(done);
        });
    });

    describe('pre and post calls', function() {
        it('should call the post functions after (in the right order) the method', function(done) {
            Bait.pre(testObj, 'method', testMethods.test1);
            Bait.pre(testObj, 'method', testMethods.test2);
            Bait.pre(testObj, 'method', testMethods.test3);
            Bait.pre(testObj, 'method', testMethods.test4);
            Bait.post(testObj, 'method', testMethods.test1);
            Bait.post(testObj, 'method', testMethods.test2);
            Bait.post(testObj, 'method', testMethods.test3);
            Bait.post(testObj, 'method', testMethods.test4);

            testObj.method('hi').then(function(result){
                result.should.eql({test2: 'test2', test3: 'test3', test4: 'test4'});
                callOrder.should.be.eql(['test1', 'test2', 'test3', 'test4', 'method', 'test1', 'test2', 'test3', 'test4']);
            }).then(function(){
                // call it again
                return testObj.method('hi');
            }).then(function(result){
                result.should.eql({test2: 'test2', test3: 'test3', test4: 'test4'});
                callOrder.should.be.eql(['test1', 'test2', 'test3', 'test4', 'method', 'test1', 'test2', 'test3', 'test4', 'test1', 'test2', 'test3', 'test4', 'method', 'test1', 'test2', 'test3', 'test4']);
                done();
            }).catch(done);
        });

        it('should pass onward the return values through the chain as arguments for the next hook/method', function(done) {
            Bait.pre(testObj, 'method', testMethods.test1);
            Bait.post(testObj, 'method', testMethods.test2);
            testObj.method('hi').then(function(result){
                testMethods.test1Args.should.eql(['hi']);
                testObj.methodArgs.should.eql(['test1']);
                testMethods.test2Args.should.eql(['method']);

                result.should.eql({test2: 'test2'});
                done();
            }).catch(done);
        });

        it('should return before resolving the whole chain completely', function(done) {
            Bait.pre(testObj, 'method', testMethods.test4);
            Bait.post(testObj, 'method', testMethods.test4);
            var result = testObj.method('hi');
            var timeoOrder = [];

            result.then(function(){
                // this should resolve later, so should be pushed second.
                timeoOrder.push('second');
                timeoOrder.should.eql(['first', 'second']);
                done();
            }).catch(done);

            setTimeout(function(){
                timeoOrder.push('first');
            }, 1);

        });
    });

    describe('pre error propagation', function() {
        it('test fn should throw an error', function() {
            testMethods.test6.should.throw(Error);
        });

        it('should catch thrown error', function(done) {
            Bait.pre(testObj, 'method', testMethods.test6);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                done();
            });
        });


        it('should catch error and not call any more functions', function(done) {
            Bait.pre(testObj, 'method', testMethods.test6);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                callOrder.should.eql(['test6']);
                done();
            });
        });

        it('should catch custom error and not call any more functions', function(done) {
            Bait.pre(testObj, 'method', testMethods.test8);
            testObj.method().catch(CustomError, function(err){
                err.should.instanceof(CustomError);
                callOrder.should.eql(['test8']);
                done();
            });
        });

        it('should propagete errors from deeper promises and not call any more functions', function(done) {
            Bait.pre(testObj, 'method', testMethods.test7);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                callOrder.should.eql(['test7']);
                done();
            });
        });

        it('should catch rejections and not call any more functions', function(done) {
            Bait.pre(testObj, 'method', testMethods.test5);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                callOrder.should.eql(['test5']);
                done();
            });
        });

        it('should catch deep rejections and not call any more functions', function(done) {
            Bait.pre(testObj, 'method', testMethods.test9);
            testObj.method().catch(function(err){
                err.should.eql('test9');
                callOrder.should.eql(['test9']);
                done();
            });
        });
    });

    describe('post error propagation', function() {
        it('test fn should throw an error', function() {
            testMethods.test6.should.throw(Error);
        });

        it('should catch thrown error', function(done) {
            Bait.post(testObj, 'method', testMethods.test6);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                done();
            });
        });


        it('should catch error and not call any more functions', function(done) {
            Bait.post(testObj, 'method', testMethods.test6);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                callOrder.should.eql(['method', 'test6']);
                done();
            });
        });

        it('should catch custom error and not call any more functions', function(done) {
            Bait.post(testObj, 'method', testMethods.test8);
            testObj.method().catch(CustomError, function(err){
                err.should.instanceof(CustomError);
                callOrder.should.eql(['method', 'test8']);
                done();
            });
        });

        it('should propagete errors from deeper promises and not call any more functions', function(done) {
            Bait.post(testObj, 'method', testMethods.test7);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                callOrder.should.eql(['method', 'test7']);
                done();
            });
        });

        it('should catch rejections and not call any more functions', function(done) {
            Bait.post(testObj, 'method', testMethods.test5);
            testObj.method().catch(function(err){
                err.should.instanceof(Error);
                callOrder.should.eql(['method', 'test5']);
                done();
            });
        });

        it('should catch deep rejections and not call any more functions', function(done) {
            Bait.post(testObj, 'method', testMethods.test9);
            testObj.method().catch(function(err){
                err.should.eql('test9');
                callOrder.should.eql(['method', 'test9']);
                done();
            });
        });
    });

    describe('orig', function() {
        it('should return the original method', function(done) {
            Bait.pre(testObj, 'method', testMethods.test6);
            Bait.post(testObj, 'method', testMethods.test6);
            var method = Bait.orig(testObj, 'method');
            method('hi').then(function(result){
                result.should.eql('method');
                callOrder.should.eql(['method']);
                done();
            });
        });
    });

});
