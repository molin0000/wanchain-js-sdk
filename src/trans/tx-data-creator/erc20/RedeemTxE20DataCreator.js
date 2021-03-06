'use strict'

let TxDataCreator = require('../common/TxDataCreator');
let ccUtil        = require('../../../api/ccUtil');
let utils         = require('../../../util/util');

let logger = utils.getLogger('RedeemTxE20DataCreator.js');

/**
 * @class
 * @augments  TxDataCreator
 */
class RedeemTxE20DataCreator extends TxDataCreator{
    /**
     * @constructor
     * @param {Object} input  - {@link CrossChain#input input} of final users.(gas, gasPrice, value and so on)
     * @param {Object} config - {@link CrossChain#config config} of cross chain used.
     */
    constructor(input,config) {
        super(input,config);
    }

    /**
     * @override
     * @returns {Promise<{code: boolean, result: null}>}
     */
    async createCommonData(){
        logger.debug("Entering RedeemTxE20DataCreator::createCommonData");

        let record          = global.wanDb.getItem(this.config.crossCollection,{hashX:this.input.hashX});
        this.input.x        = record.x;
        this.retResult.code      = true;

        let  commonData     = {};

        let chain = global.chainManager.getChain(this.input.chainType);
        let addr = await chain.getAddress(record.to.walletID, record.to.path);
        utils.addBIP44Param(this.input, record.to.walletID, record.to.path);

        commonData.from     = ccUtil.hexAdd0x(addr.address);
        commonData.to       = this.config.dstSCAddr;
        commonData.value    = 0;
        commonData.gasPrice = ccUtil.getGWeiToWei(this.input.gasPrice);
        commonData.gasLimit = Number(this.input.gasLimit);
        commonData.gas      = Number(this.input.gasLimit);
        commonData.nonce    = null;

        try{
            if(this.input.hasOwnProperty('testOrNot')){
                commonData.nonce  = ccUtil.getNonceTest();
            }else{
                commonData.nonce  = await ccUtil.getNonceByLocal(commonData.from,this.input.chainType);
                logger.info("RedeemTxE20DataCreator::createCommonData getNonceByLocal,%s",commonData.nonce);
            }
            logger.debug("nonce:is ",commonData.nonce);
        }catch(error){
            logger.error("error:",error);
            this.retResult.code      = false;
            this.retResult.result    = error;
        }
        if(this.input.chainType === 'WAN'){
            commonData.Txtype = '0x01';
        }
        this.retResult.result  = commonData;

        return Promise.resolve(this.retResult);
    }

    /**
     * @override
     * @returns {{code: boolean, result: null}|transUtil.this.retResult|{code, result}}
     */
    createContractData(){
        logger.debug("Entering RedeemTxE20DataCreator::createContractData");
        try{
            let data = ccUtil.getDataByFuncInterface(this.config.midSCAbi,
                this.config.midSCAddr,
                this.config.redeemScFunc,
                this.config.srcSCAddr,              // parameter
                this.input.x                        // parameter
            );
            this.retResult.result = data;
            this.retResult.code   = true;
        }catch(error){
            logger.error("createContractData: error: ",error);
            this.retResult.result = error;
            this.retResult.code   = false;
        }
        return this.retResult;
    }

}

module.exports = RedeemTxE20DataCreator;
