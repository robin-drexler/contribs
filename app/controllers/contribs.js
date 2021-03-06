var Recaptcha = require('recaptcha').Recaptcha
  , createFeed = require(__dirname + '/../../lib/feed.js')
  , getCreatedKey = require(__dirname + '/../../lib/session-keys.js').getCreatedKey
  , getVotedKey = require(__dirname + '/../../lib/session-keys.js').getVotedKey;

var Contribs = function () {
  this.respondsWith = ['html', 'json', 'xml', 'js', 'txt'];

  this.index = function (req, resp, params) {
    var self = this
      , Contrib = geddy.model.Contrib;

    Contrib.all({}, {limit: 300},
      function (err, contribs) {
        self.respondWith(contribs, {type:'Contrib'});
    });
  };

  this.add = function (req, resp, params) {
    var self = this
      , config = geddy.config
      , recaptcha = new Recaptcha(config.recaptcha.publicKey, config.recaptcha.privateKey)
      , Interest = geddy.model.Interest
      , interest;


    if (params.interest_id) {
      Interest.first(params.interest_id, function (err, interest) {
        self.respond({ recaptcha: recaptcha.toHTML(), interest: interest, contrib: params});
      });
    } else {
      self.respond({ recaptcha: recaptcha.toHTML(), interest: interest, contrib: params });
    }
  };

  this.create = function (req, resp, params) {
    var self = this
      , contrib = geddy.model.Contrib.create(params)
      , config = geddy.config;

    var recaptcha = new Recaptcha(config.recaptcha.publicKey, config.recaptcha.privateKey, {
      remoteip: req.connection.remoteAddress,
      challenge: params.recaptcha_challenge_field,
      response: params.recaptcha_response_field
    });

    
    recaptcha.verify(function (success, err) {
      if (success || !geddy.config.recaptcha.enabled && contrib.isValid()) {
        contrib.save(function (er, data) {
          var success = 'Created Contribution! Thank you so much!';
          self.session.set(getCreatedKey(contrib.id), 'c');
          self.redirect(geddy.viewHelpers.contribPath(contrib.id));
        });
      } else {
        contrib.errors = contrib.errors || [];
        contrib.errors.captcha = "Wrong Captcha";
        self.respondWith(contrib);
      }
    });
  };

  this.show = function (req, resp, params) {
    var self = this
      , Contrib = geddy.model.Contrib
      , created = self.session.get(getCreatedKey(params.id))
      , voted = self.session.get(getVotedKey(params.id));

    Contrib.first(params.id, {includes: ['karmas']},
        function (err, contrib) {
      if (err) {
        throw err;
      }
      if (!contrib) {
        throw new geddy.errors.NotFoundError();
      }
      else {
        if (!contrib.interestId) {
          self.respond({contrib: contrib, status: err, showTweetButton: created, hasVoted: voted});
        } else {
          geddy.model.Interest.first(contrib.interestId,
              function (er, interest) {
            contrib.interest = interest;
            self.respond({contrib: contrib, status: er, showTweetButton: created, hasVoted: voted});
          });
        }
      }
    });
  };

  this.xml = function (req, resp, params) {
    var self = this
      , Contrib = geddy.model.Contrib
      , feed;

    Contrib.all(function (err, contribs) {
      feed = createFeed(contribs);
      self.output(200, {'Content-Type': 'application/xml'}, feed.render('atom-1.0'));
    });
  };

};

exports.Contribs = Contribs;
