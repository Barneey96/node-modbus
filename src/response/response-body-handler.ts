import ModbusResponseBody from './response-body.js'

/** Parses the response body of a single function code. The built-in response body
 * classes (e.g. ReadHoldingRegistersResponseBody) satisfy it through their static fromBuffer.
 */
export default interface IResponseBodyHandler<Body extends ModbusResponseBody = ModbusResponseBody> {
  /** @param {Buffer} buffer Starts at the function code. With Modbus/RTU the returned body's
   *   byteCount decides how many bytes are consumed before the CRC.
   * @returns {ModbusResponseBody | null} null if not enough data has arrived yet.
   */
  fromBuffer (buffer: Buffer): Body | null
}
