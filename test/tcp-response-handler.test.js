'use strict'

/* global describe, it, beforeEach */

const assert = require('assert')
const TCPResponseHandler = require('../dist/tcp-client-response-handler.js').default

describe('Modbus/TCP Client Response Handler Tests', function () {
  let handler

  beforeEach(function () {
    handler = new TCPResponseHandler()
  })

  /* we are using the read coils function to test the modbus/tcp specifics */

  it('should handle a valid read coils response', function () {
    const responseBuffer = Buffer.from([
      0x00, 0x01, // transaction id
      0x00, 0x00, // protocol
      0x00, 0x05, // byte count
      0x03,       // unit id
      0x01,       // function code
      0x02,       // byte count
      0xdd,       // coils
      0x00
    ])

    handler.handleData(responseBuffer)

    const response = handler.shift()

    assert.ok(response !== null)
    assert.equal(1, response.id)
    assert.equal(0, response.protocol)
    assert.equal(5, response.bodyLength)
    assert.equal(11, response.byteCount)
    assert.equal(3, response.unitId)
    assert.equal(1, response.body.fc)
    assert.deepEqual([1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], response.body.valuesAsArray)
  })
  it('should handle a valid FC43/14 read device identification response', function () {
    const responseBuffer = Buffer.from([
      0x00, 0x01, // transaction id
      0x00, 0x00, // protocol
      0x00, 0x0E, // byte count
      0x03,       // unit id
      0x2B,       // function code
      0x0E,       // MEI type
      0x01,       // read device id code
      0x01,       // conformity level
      0x00,       // more follows
      0x00,       // next object id
      0x01,       // number of objects
      0x00,       // object id
      0x04,       // object value length
      0x41, 0x43, 0x4D, 0x45 // object value: ACME
    ])

    handler.handleData(responseBuffer)

    const response = handler.shift()

    assert.ok(response !== undefined)
    assert.equal(0x01, response.id)
    assert.equal(0x00, response.protocol)
    assert.equal(0x0E, response.bodyLength)
    assert.equal(0x14, response.byteCount)
    assert.equal(0x03, response.unitId)
    assert.equal(0x2B, response.body.fc)
    assert.equal(0x0E, response.body.meiType)
    assert.equal(0x01, response.body.readDeviceIdCode)
    assert.equal(0x01, response.body.conformityLevel)
    assert.equal(0x01, response.body.numberOfObjects)
    assert.equal('ACME', response.body.objects[0].value.toString('ascii'))
  })
  it('should handle a exception', function () {
    const responseBuffer = Buffer.from([
      0x00, 0x01, // transaction id
      0x00, 0x00, // protocol
      0x00, 0x03, // byte count
      0x03,       // unit id
      0x81,       // exception code for fc 0x01
      0x01        // exception code ILLEGAL FUNCTION
    ])

    handler.handleData(responseBuffer)

    const response = handler.shift()

    assert.ok(response !== undefined)
    assert.equal(0x01, response.id)
    assert.equal(0x00, response.protocol)
    assert.equal(0x03, response.bodyLength)
    assert.equal(0x09, response.byteCount)
    assert.equal(0x03, response.unitId)
    assert.equal(0x01, response.body.fc)
    assert.equal(0x01, response.body.code)
    assert.equal('ILLEGAL FUNCTION', response.body.message)
  })
  it('should handle a FC43/14 exception with explicit MEI type', function () {
    const responseBuffer = Buffer.from([
      0x00, 0x01, // transaction id
      0x00, 0x00, // protocol
      0x00, 0x04, // byte count
      0x03,       // unit id
      0xAB,       // exception code for fc 0x2B
      0x0E,       // MEI type
      0x03        // exception code ILLEGAL DATA VALUE
    ])

    handler.handleData(responseBuffer)

    const response = handler.shift()

    assert.ok(response !== undefined)
    assert.equal(0x01, response.id)
    assert.equal(0x00, response.protocol)
    assert.equal(0x04, response.bodyLength)
    assert.equal(0x0A, response.byteCount)
    assert.equal(0x03, response.unitId)
    assert.equal(0x2B, response.body.fc)
    assert.equal(0x0E, response.body.meiType)
    assert.equal(0x03, response.body.code)
    assert.equal('ILLEGAL DATA VALUE', response.body.message)
  })
  it('should handle a FC43 exception without MEI type', function () {
    const responseBuffer = Buffer.from([
      0x00, 0x01, // transaction id
      0x00, 0x00, // protocol
      0x00, 0x03, // byte count
      0x03,       // unit id
      0xAB,       // exception code for fc 0x2B
      0x01        // exception code ILLEGAL FUNCTION
    ])

    handler.handleData(responseBuffer)

    const response = handler.shift()

    assert.ok(response !== undefined)
    assert.equal(0x01, response.id)
    assert.equal(0x00, response.protocol)
    assert.equal(0x03, response.bodyLength)
    assert.equal(0x09, response.byteCount)
    assert.equal(0x03, response.unitId)
    assert.equal(0x2B, response.body.fc)
    assert.equal(undefined, response.body.meiType)
    assert.equal(0x01, response.body.code)
    assert.equal('ILLEGAL FUNCTION', response.body.message)
  })
  it('should handle a chopped response', function () {
    const responseBufferA = Buffer.from([
      0x00, 0x01, // transaction id
      0x00, 0x00, // protocol
      0x00, 0x05  // byte count
    ])
    const responseBufferB = Buffer.from([
      0x03,       // unit id
      0x01,       // function code
      0x02,       // byte count
      0xdd,       // coils
      0x00
    ])

      /* deliver first part */
    handler.handleData(responseBufferA)

    let response = handler.shift()

    assert.ok(response === undefined)

      /* deliver second part */
    handler.handleData(responseBufferB)

    response = handler.shift()

    assert.ok(response !== undefined)
    assert.equal(1, response.id)
    assert.equal(0, response.protocol)
    assert.equal(5, response.bodyLength)
    assert.equal(11, response.byteCount)
    assert.equal(3, response.unitId)
    assert.equal(1, response.body.fc)
    assert.deepEqual([1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], response.body.valuesAsArray)
  })
})
