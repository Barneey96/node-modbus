'use strict'

/* global describe, it, beforeEach */

const assert = require('assert')
const EventEmitter = require('events')
const Modbus = require('../')

const ModbusRTUClientResponseHandler = require('../dist/rtu-client-response-handler.js').default
const ModbusTCPClientResponseHandler = require('../dist/tcp-client-response-handler.js').default

const { ReadHoldingRegistersResponseBody } = Modbus.responses

/* Parses a read holding registers response that always carries a single register,
 * whatever the byte count field says. */
const singleRegisterHandler = {
  calls: 0,
  fromBuffer (buffer) {
    this.calls++
    if (buffer.length < 4) {
      return null
    }
    const payload = buffer.slice(2, 4)
    return new ReadHoldingRegistersResponseBody(2, [payload.readUInt16BE(0)], payload)
  }
}

describe('Custom Response Handler Tests.', function () {
  beforeEach(function () {
    singleRegisterHandler.calls = 0
  })

  describe('Modbus/RTU Client Response Handler.', function () {
    let handler

    beforeEach(function () {
      handler = new ModbusRTUClientResponseHandler()
    })

    it('should consume as many bytes as the custom body reports', function () {
      handler.registerResponseHandler(0x03, singleRegisterHandler)

      handler.handleData(Buffer.from([
        0x01, // address
        0x03, // function code
        0xff, // broken byte count
        0x12, 0x34, // register
        0xcd, 0xab, // crc
        0x01, // address of the next response
        0x03, 0x02, 0x56, 0x78, 0x34, 0x12
      ]))

      const first = handler.shift()
      const second = handler.shift()

      assert.deepEqual([0x1234], first.body.valuesAsArray)
      assert.equal(0xabcd, first.crc)
      assert.deepEqual([0x5678], second.body.valuesAsArray)
      assert.equal(0x1234, second.crc)
      assert.strictEqual(undefined, handler.shift())
    })

    it('should wait for more data while the custom handler returns null', function () {
      handler.registerResponseHandler(0x03, singleRegisterHandler)

      handler.handleData(Buffer.from([0x01, 0x03, 0xff, 0x12]))
      assert.strictEqual(undefined, handler.shift())

      handler.handleData(Buffer.from([0x34, 0xcd, 0xab]))
      assert.deepEqual([0x1234], handler.shift().body.valuesAsArray)
    })

    it('should leave other function codes to the built-in parser', function () {
      handler.registerResponseHandler(0x03, singleRegisterHandler)

      handler.handleData(Buffer.from([0x01, 0x01, 0x01, 0x01, 0xcd, 0xab]))

      assert.equal(0, singleRegisterHandler.calls)
      assert.equal(0x01, handler.shift().body.fc)
    })

    it('should use the built-in parser after unregistering', function () {
      handler.registerResponseHandler(0x03, singleRegisterHandler)

      assert.equal(true, handler.unregisterResponseHandler(0x03))
      assert.equal(false, handler.unregisterResponseHandler(0x03))

      handler.handleData(Buffer.from([0x01, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78, 0xcd, 0xab]))

      assert.equal(0, singleRegisterHandler.calls)
      assert.deepEqual([0x1234, 0x5678], handler.shift().body.valuesAsArray)
    })

    it('should treat a throwing handler like an incomplete response', function () {
      handler.registerResponseHandler(0x03, { fromBuffer: () => { throw new Error('boom') } })

      handler.handleData(Buffer.from([0x01, 0x03, 0x02, 0x12, 0x34, 0xcd, 0xab]))

      assert.strictEqual(undefined, handler.shift())
    })
  })

  describe('Modbus/TCP Client Response Handler.', function () {
    it('should pass exactly the PDU to the custom handler', function () {
      const handler = new ModbusTCPClientResponseHandler()
      let received

      handler.registerResponseHandler(0x03, {
        fromBuffer (buffer) {
          received = buffer
          return singleRegisterHandler.fromBuffer(buffer)
        }
      })

      handler.handleData(Buffer.from([
        0x00, 0x01, // transaction id
        0x00, 0x00, // protocol
        0x00, 0x05, // length
        0x01, // unit id
        0x03, 0xff, 0x12, 0x34 // pdu with broken byte count
      ]))

      assert.deepEqual(Buffer.from([0x03, 0xff, 0x12, 0x34]), received)
      assert.deepEqual([0x1234], handler.shift().body.valuesAsArray)
    })
  })

  describe('Modbus Client.', function () {
    let socket

    beforeEach(function () {
      socket = new EventEmitter()
      socket.write = function () {}
    })

    it('should resolve the request with the body of the custom handler', function (done) {
      const client = new Modbus.client.TCP(socket)
      client.registerResponseHandler(0x03, singleRegisterHandler)

      socket.emit('connect')

      client.readHoldingRegisters(0, 1)
        .then(function (resp) {
          assert.equal(1, singleRegisterHandler.calls)
          assert.deepEqual([0x1234], resp.response.body.valuesAsArray)
          done()
        }).catch(done)

      socket.emit('data', Buffer.from([
        0x00, 0x01, // transaction id
        0x00, 0x00, // protocol
        0x00, 0x05, // length
        0x01, // unit id
        0x03, 0xff, 0x12, 0x34
      ]))
    })

    it('should unregister a custom handler on the client', function () {
      const client = new Modbus.client.RTU(new EventEmitter(), 1)
      client.registerResponseHandler(0x03, singleRegisterHandler)

      assert.equal(true, client.unregisterResponseHandler(0x03))
      assert.equal(false, client.unregisterResponseHandler(0x03))
    })

    it('should keep custom handlers per client', function (done) {
      const otherClient = new Modbus.client.TCP(new EventEmitter())
      const client = new Modbus.client.TCP(socket)
      otherClient.registerResponseHandler(0x03, singleRegisterHandler)

      socket.emit('connect')

      client.readHoldingRegisters(0, 1)
        .then(function (resp) {
          assert.equal(0, singleRegisterHandler.calls)
          assert.deepEqual([0x1234], resp.response.body.valuesAsArray)
          done()
        }).catch(done)

      socket.emit('data', Buffer.from([
        0x00, 0x01, 0x00, 0x00, 0x00, 0x05, 0x01,
        0x03, 0x02, 0x12, 0x34
      ]))
    })
  })
})
