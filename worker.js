const { PeerRPCServer }  = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')


const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCServer(link, {
  timeout: 300000
})
peer.init()

// const port = 1024 + Math.floor(Math.random() * 1000)
const port = 1024;
const service = peer.transport('server')
service.listen(port)

// list of orders registered and transactions validated
// both that would be made visible to the clients.
const orders = new Map();
const processedOrders = new Map();

const buyPriorityHash = []; // list of hashes ordered based on highest price
const sellPriorityHash = []; // list of hashes ordered based on lowest price

setInterval(function () {
  link.announce('pedro_dex', service.port, {})
}, 1000)

// insertion sorted orders based on the criteria I'm looking for
// in buy priority queue, I want to have the order prices descending, if sell, ascending.
function prioritiseOrders(orderType, order) {
  const hashQueue = orderType === 'buy' ? buyPriorityHash : sellPriorityHash;

  for (let i = 0; i < queue.length; i++) {
    const shouldInsert = orderType === 'buy' ? order.price >= orders.get(hashQueue[i]) : order.price < orders.get(hashQueue[i]);
    if (shouldInsert) {
      queue.splice(i, 0, order.hash);
    }
  }
}

function handleNewOrderRequest (orderType, hash) {
  const processedOrder = processedOrders.get(hash);

  if (processedOrder) {
    // TODO: add matching order to response
    handler.reply(null, { msg: `Order was already finalised and matched with order with hash ${processedOrder.matchingTransactionHash}` });
  }
  else if (!orders.get(hash)) {
    order.hash = hash;
    orders.set(hash, order);
    prioritiseOrders(orderType, order);
    console.log(`Order with hash ${hash} was successfully added to the orderbook.`);
  }
  else {
    console.log(`Order with hash ${hash} was already added beforehand, awaiting for a match.`);
  }
}

function matchTransaction (orderType, hash, cb) {
  const currentOrder = orders.get(hash);

  const firstAvailableOrderHash = orderType === 'buy' ? sellPriorityHash[0] : buyPriorityHash[0];

  if (firstAvailableOrderHash) {
    const firstAvailableOrder = orders.get(firstAvailableOrderHash);
    
    currentOrder.matchingTransactionHash = firstAvailableOrderHash;
    firstAvailableOrder.matchingTransactionHash = hash;
    
    /**
     * This is the bit that I realised a bit late in the progress of my development.
     * As I finished a general structure for what would be a really rough and generic of a matching engine,
     * I realised that these processed orders should also be stored in the orders DHT.
     * If this had been the case in my implementation, this would mean I'd have an async request here,
     * that would potentially have clients attempting to use the same resource as they'd be constatly matched
     * with the best proposal for them every time.
     * 
     * I'd have then tried to add a flag to the orders in the DHT (not on the worker level), and then would be able to check
     * if there was another client trying to access the same resource. Ran out of time here.
     */
    processedOrders.set(currentOrder.hash, currentOrder);
    processedOrders.set(firstAvailableOrder.hash, firstAvailableOrder);

    orderType === 'buy' ? sellPriorityHash.shift() : buyPriorityHash.shift();
    orders.delete(firstAvailableOrder);
    orders.delete(hash);
    return {
      matchedHash: firstAvailableOrder,
    };
  }

  return undefined;
}

service.on('request', (rid, key, hash, handler) => {
  console.log(hash)
  if (hash) {
    link.get(hash, (err, res) => {
      const order = JSON.parse(res.v);
      
      // insert new order in the orderbook
      handleNewOrderRequest(order.type, hash);

      // decide whether the transaction should happen
      const transactionResult = matchTransaction(order.type, hash);

      if (transactionResult) {
        const message = `Order with hash ${hash} successfully matched with the order with hash ${transactionResult.matchedHash}.`;
        console.log(message);
        handler.reply(null, { msg: message });
      }
      else {
        const message = `Order with hash ${hash} awaiting for a matching transaction to be made available.`;
        console.log(message);
        handler.reply(null, { msg: message });
      }
    });
    
  }
  else {
    const message = 'Hash not found.';
    console.error(message);
    handler.reply(null, {err: message});
  }
})