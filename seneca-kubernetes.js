
const fs = require('fs')
const async = require('async')
const request = require('request')
const find_ip = require('get-ip-address')
const caFile = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
const tokenFile = '/var/run/secrets/kubernetes.io/serviceaccount/token'


function get_ca_file(next) {
  fs.readFile(caFile, next)
}

function get_token_file(next) {
  fs.readFile(tokenFile, next)
}

function get_credentials(done) {
  async.parallel({
    ca: get_ca_file,
    token: get_token_file
  }, function (err, results) {
    if (err) {
      return done(err)
    }

    done(null, results.ca, results.token)
  })
}

function get_pods (done) {
  get_credentials(function (err, ca, token) {

    if (err) {
      return done(err)
    }

    const options = {
      url: 'https://kubernetes/api/v1/pods',
      ca: ca,
      headers: {
        "Authorization": "Bearer " + token
      }
    }

    request.get(options, function (err, res, body) {

      if (err) {
        return done(err)
      }

      body = JSON.parse(body)

      const pods = body.items.map(function (item) {
        return {
          status: item.status.phase,
          ip: item.status.podIP,
          labels: item.metadata.labels
        }
      })

      done(null, pods)
    })
  })
}


function kubernetes_plugin (options) {
  const seneca = this

  this.add('init:kubernetes', function (args, done) {

    get_pods(function got_pods (err, pods) {
      if (err) {
        return done(err)
      }

      seneca.options().plugin.kubernetes = {
        myip: find_ip(),
        pods: pods
      }

      done()
    })

  })

  return 'kubernetes'
}

module.exports = kubernetes_plugin