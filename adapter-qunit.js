(function() {
  var done, doneTimeout, countAsync, emberQunit;

  done = null;
  doneTimeout = null;
  isAsync = false;

  Ember.Test.MochaAdapter = Ember.Test.Adapter.extend({
    init: function() {
      this._super();
      window.Mocha.interfaces['ember-qunit'] = emberQunit;
      window.mocha.ui('ember-qunit');
    },
    asyncStart: function() {
      isAsync = true;
      clearTimeout(doneTimeout);
    },
    asyncEnd: function() {
      isAsync = false;
      if (done) {
        doneTimeout = setTimeout(function() {
          var d = done;
          done = null;
          d();
        });
      }
    },
    exception: function(reason) {
      var error, d;

      error = new Error(reason);
      if (done) {
        d = done;
        done = null;
        d(error);
      } else {
        setTimeout(function() {
          throw error;
        });
      }
    }
  });


  function fixAsync(suites, methodName) {
    return function(fn) {
      if (fn.length === 1) {
        suites[0][methodName](fn);
      } else {
        suites[0][methodName](function(d) {
          invoke(this, fn, d);
        });
      }
    };
  }

  function invoke(context, fn, d) {
    done = d;
    fn.call(context);
    if (!isAsync) {
      done = null;
      d();
    }
  }


  /**
    ember-qunit mocha interface.
    This interface allows
    the Ember.js tester
    to forget about sync / async
    and treat all tests the same.

    This interface, along with the adapter
    will take care of handling sync vs async
  */

  emberQunit = function(suite) {
    var suites = [suite];

    suite.on('pre-require', function(context, file, mocha) {

      context.setup = fixAsync(suites, 'setup');

      context.teardown = fixAsync(suites, 'teardown');


      context.test = context.specify = function(title, fn){
        var suite = suites[0], test;
        if (suite.pending) {
          fn = null;
        }
        if (!fn || fn.length === 1) {
          test = new Mocha.Test(title, fn);
        } else {
          var method = function(d) {
            invoke(this, fn, d);
          };
          method.toString = function() {
            return fn.toString();
          }
          test = new Mocha.Test(title, method);
        }
        suite.addTest(test);
        return test;
      };

      context.suite = context.suite = function(title, opts){
        if (suites.length > 1) suites.shift();
        var suite = Mocha.Suite.create(suites[0], title);
        suites.unshift(suite);
        if (opts) {
          suite.beforeEach(function() { for (var k in opts) this[k] = opts[k] });
          if (opts.setup) suite.beforeEach(opts.setup);
          if (opts.teardown) suite.afterEach(opts.teardown);
        }
      };

      context.xsuite =
      context.xcontext =
      context.suite.skip = function(title, fn){
        var suite = Mocha.Suite.create(suites[0], title);
        suite.pending = true;
        suites.unshift(suite);
        fn.call(suite);
        suites.shift();
      };

      context.suite.only = function(title, fn){
        var suite = context.suite(title, fn);
        mocha.grep(suite.fullTitle());
      };


      context.test.only = function(title, fn){
        var test = context.test(title, fn);
        mocha.grep(test.fullTitle());
      };


      context.xtest =
      context.xspecify =
      context.test.skip = function(title){
        context.test(title);
      };


    });

  };


}());
