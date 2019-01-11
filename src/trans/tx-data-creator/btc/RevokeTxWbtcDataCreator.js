'use strict'

const bitcoin = require('bitcoinjs-lib');
const sdkConfig  = require('../../../conf/config');

let TxDataCreator = require('../common/TxDataCreator');
let btcUtil       =  require('../../../api/btcUtil');
let ccUtil        =  require('../../../api/ccUtil');

class RevokeTxWbtcDataCreator extends TxDataCreator{
    /**
     * @param: {Object} -
     *     input {
     *         hashX:    -- Do NOT start with '0x'
     *         gas:
     *         gasPrice:
     *         password:
     *         nonce:    -- optional
     *     }
     */
    constructor(input,config) {
        super(input,config);
        this.record = null;
    }

    async createCommonData(){
      global.logger.debug("Entering RevokeTxWbtcDataCreator::createCommonData");

      let input  = this.input;
      let config = this.config;

      if (input.hashX === undefined) { 
          this.retResult.code = false;
          this.retResult.result = "Input missing 'hashX'.";
      } else if (input.gas === undefined) {
          this.retResult.code = false;
          this.retResult.result = "Input missing 'gas'.";
      } else if (input.gasPrice === undefined) {
          this.retResult.code = false;
          this.retResult.result = "Input missing 'gasPrice'.";
      } else if (input.password === undefined) {
          this.retResult.code = false;
          this.retResult.result = "Input missing 'password'.";
      } else {
          let commData = {};
          // Notice: hashX should NOT prefix with '0x'
          let record = global.wanDb.getItem(this.config.crossCollection, {HashX:input.hashX});
          if (record) { 
              this.record = record;

              commData.Txtype = "0x01"; // WAN
              commData.from  = '0x' + record.from; // TODO: should prefix with '0x'???
              //commData.to    = config.dstSCAddr;   // wanHtlcAddrBtc
              commData.to    = config.midSCAddr;   // wanHtlcAddrBtc
              commData.value = 0;
              commData.gasPrice = Number(input.gasPrice);//ccUtil.getGWeiToWei(input.gasPrice);
              commData.gasLimit = Number(input.gas);
              commData.gas = Number(input.gas);

              try {
                  commData.nonce = await ccUtil.getNonceByLocal(commData.from, 'WAN'); // TODO:
                  global.logger.info("RevokeTxWbtcDataCreator::createCommonData getNonceByLocal,%s",commData.nonce);
                  global.logger.debug("nonce is ", commData.nonce);

                  this.retResult.result = commData;
                  this.retResult.code   = true;
              } catch (error) {
                  global.logger.error("error:", error);
                  this.retResult.code = false;
                  this.retResult.result = error;
              }
          } else {
              this.retResult.code   = false;
              this.retResult.result = "Record not found";
          }
      }
      global.logger.debug("RevokeTxWbtcDataCreator::createCommonData is completed.");
      return this.retResult;
    }

    createContractData(){
      global.logger.debug("Entering RevokeTxWbtcDataCreator::createContractData");

      let input  = this.input;
      let config = this.config;
      try {
          global.logger.debug("Revoke WBTC contract function:", config.revokeScFunc);
          let data = ccUtil.getDataByFuncInterface(
                  config.midSCAbi,     // ABI of wan
                  config.midSCAddr,    // WAN HTLC SC addr
                  config.revokeScFunc, // wbtc2btcRevoke
                  '0x' + input.hashX         
              );
          this.retResult.code   = true;
          this.retResult.result = data;
      } catch (error) {
          global.logger.error("Caught error when building contract data", error);
          this.retResult.code   = false;
          this.retResult.result = error 
      }
      global.logger.debug("RevokeTxWbtcDataCreator::createContractData is completed.");
      return this.retResult;
    }
}

module.exports = RevokeTxWbtcDataCreator;
