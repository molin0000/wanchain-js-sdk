'use strict'
let     Transaction               = require('../../Transaction/common/Transaction');
let     E20DataSign               = require('../../DataSign/erc20/E20DataSign');
let     E20DataSignWan            = require('../../DataSign/wan/WanDataSign');
let     LockTxE20DataCreator      = require('../../TxDataCreator/erc20/LockTxE20DataCreator');
let     CrossChain                = require('../common/CrossChain');
let     errorHandle               = require('../../transUtil').errorHandle;
let     retResult                 = require('../../transUtil').retResult;
let     ccUtil                    = require('../../../api/ccUtil');

let     CrossChainE20Approve      = require('./CrossChainE20Approve');

class CrossChainE20Lock extends CrossChain{
  constructor(input,config) {
    super(input,config);
    this.input.chainType = config.srcChainType;
    this.input.hasX = null;     // from approve
    this.input.x    = null;     // from approve
  }

  createDataCreator(){
    global.logger.debug("Entering CrossChainE20Lock::createDataCreator");
    retResult.code = true;
    retResult.result = new LockTxE20DataCreator(this.input,this.config);
    return retResult;
  }
  createDataSign(){
    global.logger.debug("Entering CrossChainE20Lock::createDataSign");
    retResult.code = true;
    if(this.input.chainType === 'WAN'){
      retResult.result = new E20DataSignWan(this.input,this.config);
    }else{
      retResult.result = new E20DataSign(this.input,this.config);
    }
    return retResult;
  }
  preSendTrans(signedData){
    if(this.input.hasOwnProperty('testOrNot')){
      let record = {
        "hashX" 									:this.trans.commonData.hashX,
        "x" 											:this.trans.commonData.x,
        "from"  									:this.trans.commonData.from,
        "to"  										:this.input.to,
        "storeman" 								:this.input.storeman,
        "value"  									:this.trans.commonData.value,
        "contractValue" 					:ccUtil.getWei(this.input.amount),
        "lockedTime" 							:"",
        "buddyLockedTime" 				:"",
        "srcChainAddr" 						:this.config.srcSCAddrKey,
        "dstChainAddr" 						:this.config.dstSCAddrKey,
        "srcChainType" 						:this.config.srcChainType,
        "dstChainType" 						:this.config.dstChainType,
        "status"  								:"LockSending",
        "approveTxHash" 					:"",
        "lockTxHash" 							:this.trans.commonData.hashX, // will update when sent successfully.,
        "refundTxHash"  					:"",
        "revokeTxHash"  					:"",
        "buddyLockTxHash" 				:"",
        "tokenSymbol"            :this.config.tokenSymbol,
        "tokenStand"             :this.config.tokenStand,
        "htlcTimeOut"            :"", //unit: s
        "buddyLockedTimeOut"     :"",
      };
      global.logger.debug("CrossChainE20Lock::preSendTrans");
      global.wanDb.insertItem(this.config.crossCollection,record);
      retResult.code = true;
      return retResult;
    }else{
      let record = global.wanDb.getItem(this.config.crossCollection,{hashX:this.input.hashX});

      record.status         = 'LockSending';
      global.logger.debug("CrossChainE20Lock::preSendTrans");
      global.logger.debug("collection is :",this.config.crossCollection);
      global.logger.debug("record is :",record);
      global.wanDb.updateItem(this.config.crossCollection,{hashX:record.hashX},record);
      retResult.code = true;
      return retResult;
    }
  }
  postSendTrans(resultSendTrans){
    global.logger.debug("Entering CrossChainE20Lock::postSendTrans");
    let txHash = resultSendTrans;
    let record = global.wanDb.getItem(this.config.crossCollection,{hashX:this.input.hashX});
    record.lockTxHash     = txHash;

    record.status         = 'LockSent';

    global.logger.debug("CrossChainE20Lock::postSendTrans");
    global.logger.debug("collection is :",this.config.crossCollection);
    global.logger.debug("record is :",record);
    global.wanDb.updateItem(this.config.crossCollection,{hashX:record.hashX},record);
    retResult.code = true;
    return retResult;
  }
  async run(){
    let ret;
    let  crossChainE20Approve = new CrossChainE20Approve(this.input,this.config);
    try{
      let hashX;
      let x;

      if(this.input.hasOwnProperty('testOrNot') === false){
        ret         = await crossChainE20Approve.run();
        hashX       = crossChainE20Approve.trans.commonData.hashX;
        x           = crossChainE20Approve.trans.commonData.x;

        if(ret.code === false){
          global.logger.debug("before lock, in approve error:",ret.result);
          return ret;
        }
        global.logger.debug("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
        global.logger.debug("hashX:",hashX);
        global.logger.debug("x:",x);
        global.logger.debug("this.input is :",this.input);
      }


      // for test
      if(this.input.hasOwnProperty('testOrNot')){
        x     = ccUtil.generatePrivateKey();
        hashX = ccUtil.getHashKey(x);
      }

      this.input.hashX  = hashX;
      this.input.x      = x;

      global.logger.debug("^^^^^^^^^^before await super.run^^^^^^^^^^^^^^^^^");
      // global.logger.debug("CrossChainE20Lock: trans");
      // global.logger.debug(this.trans);
      ret = await super.run();
      global.logger.debug("^^^^^^^^^^^after await super.run^^^^^^^^^^^^^^^^");
      if(ret.code === true){
        global.logger.debug("send lock transaction success!");
      }else{
        global.logger.debug("send lock transaction fail!");
        global.logger.debug(ret.result);
      }
      return ret;
    }catch(err){
      global.logger.debug("CrossChainE20Lock:async run");
      global.logger.debug(err);
      ret.code = false;
      ret.result = err;
      return ret;
    }
  }
}

module.exports = CrossChainE20Lock;