'use strict'

const Link = require('grenache-nodejs-link')
const { PeerRPCClient }  = require('grenache-nodejs-http')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const orderBuy = {
  type: 'buy',
  price: 100
}

const orderSell = {
  type: 'sell',
  price: 90
}

const peer = new PeerRPCClient(link, {})
peer.init()

setInterval(() => {
  // link.put({ v: orderBuy }, (err, hash) => {
  link.put({ v: orderSell }, (err, hash) => {

    peer.request('pedro_dex', hash, { timeout: 10000 }, (err, data) => {
      if (err) {
        console.error(err)
        process.exit(-1)
      }
      console.log(data);
    })
  })
}, 2000)