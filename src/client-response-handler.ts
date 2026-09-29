import MBAbstractResponse from './abstract-response'
import IResponseBodyHandler from './response/response-body-handler.js'
import ResponseFactory from './response/response-factory.js'

/** Modbus Client Repsonse Handler
 * @abstract
 */
export default abstract class ModbusClientResponseHandler<ResType extends MBAbstractResponse = MBAbstractResponse> {
  protected _buffer: Buffer
  protected abstract _messages: ResType[]
  protected readonly _customHandlers = new Map<number, IResponseBodyHandler>()

  /** Create new Modbus Client Response Handler */
  constructor () {
    this._buffer = Buffer.alloc(0)
  }

  /** Process new incoming data and enqueue new modbus responses.
   * @param {Buffer} data New incoming data from the socket.
   */
  public abstract handleData (data: Buffer): void

  /** Extract latest Modbus Response.
   * @returns {ModbusResponse}
   */
  public shift () {
    return this._messages.shift()
  }

  /** Parse responses of a function code with a custom handler instead of the built-in one. */
  public registerResponseHandler (fc: number, handler: IResponseBodyHandler) {
    this._customHandlers.set(fc, handler)
  }

  /** Go back to the built-in parser for a function code. Returns true if a custom handler was removed. */
  public unregisterResponseHandler (fc: number) {
    return this._customHandlers.delete(fc)
  }

  /** Parse a response body with the custom handler of its function code, if there is one. */
  protected _parseBody = (buffer: Buffer) => {
    const handler = this._customHandlers.get(buffer[0])

    if (!handler) {
      return ResponseFactory.fromBuffer(buffer)
    }

    try {
      return handler.fromBuffer(buffer)
    } catch (e) {
      return null
    }
  }
}
