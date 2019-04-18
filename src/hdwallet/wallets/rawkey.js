/**
 * Private key wallet
 *
 * Copyright (c) 2019 Wanchain.
 * It can be freely distributed under MIT license.
 */
'use strict';

const WID     = require('./walletids');
const HDWallet= require('./hdwallet');
const wanUtil = require('../../util/util');
const error   = require('../../api/error');

const logger = wanUtil.getLogger("rawkey.js");

const _BIP44_PATH_LEN = 5;
const _CHAIN_GET_PUBKEY = {
    0    : wanUtil.sec256k1PrivToPub,  // Bitcoin
    1    : wanUtil.sec256k1PrivToPub,  // Bitcoin testnet
    60   : wanUtil.sec256k1PrivToPub,  // ETH
    5718350   : wanUtil.sec256k1PrivToPub  // WAN
};

const _CIPHER_IV_MSG = "rawKeyWallet@wanchain";

/**
 * private key wallet implementation.
 * This provides a software wallet. And all HD wallet should follow it's API
 */
class RawKeyWallet extends HDWallet {
    /**
     */
    constructor(seed) {
        // supports get pubkey, privkey
        super(WID.WALLET_CAPABILITY_GET_PUBKEY|WID.WALLET_CAPABILITY_GET_PRIVATEKEY|WID.WALLET_CAPABILITY_IMPORT_PRIVATE_KEY);
        this._db   = global.hdWalletDB.getRawKeyTable();
        this._seed = seed;
    }

    /**
     * Identity number
     */
    static id() {
        return WID.WALLET_ID_RAWKEY;
    }

    static name () {
        return WID.toString(RawKeyWallet.id());
    }

    /**
     */
    open() {
        logger.info("%s opened.", RawKeyWallet.name());
        return true;
    }

    /**
     */
    close() {
        logger.info("%s closed.", RawKeyWallet.name());
        return true;
    }

    /**
     */
    async healthCheck() {
        return true;
    }

    /**
     */
    getPublicKey(path, opt) {
        logger.info("Getting public key for path %s...", path);
        let p = wanUtil.splitBip44Path(path);
        if (p.length != _BIP44_PATH_LEN) {
            logger.error(`Invalid path: ${path}`);
            throw new error.InvalidParameter(`Invalid path: ${path}`);
        }

        let chainID = p[1];
        if (chainID >= 0x80000000) {
            // Hardened derivation
            chainID -= 0x80000000;
        }

        let getPubKey = wanUtil.sec256k1PrivToPub;
        if (_CHAIN_GET_PUBKEY.hasOwnProperty(chainID)) {
            getPubKey = _CHAIN_GET_PUBKEY[chainID];
        } else {
            logger.warn(`Chain ${chainID} public key creation function not defined, assume sec256k1!`);
        }

        let ret = getPubKey(this._getPrivateKey(chainID, p[2], p[3], p[4], opt));

        logger.info("Getting public key for path %s is completed.", path);

        return ret;
    }

    /**
     */
    getPrivateKey(path, opt) {
        logger.info("Getting private key for path %s...", path);

        let p = wanUtil.splitBip44Path(path);
        if (p.length != _BIP44_PATH_LEN) {
            logger.error(`Invalid path: ${path}`);
            throw new error.InvalidParameter(`Invalid path: ${path}`);
        }

        let chainID = p[1];
        if (chainID >= 0x80000000) {
            // Hardened derivation
            chainID -= 0x80000000;
        }

        let ret =  this._getPrivateKey(chainID, p[2], p[3], p[4], opt);
        logger.info("Get private key for path %s is completed.", path);
        return ret;
    }

    /**
     */
    importPrivateKey(path, privateKey, opt) {
        logger.info("Importing private key...");
        let p = wanUtil.splitBip44Path(path);
        if (p.length != _BIP44_PATH_LEN) {
            logger.error(`Invalid path: ${path}`);
            throw new error.InvalidParameter(`Invalid path: ${path}`);
        }

        opt = opt || {};
        let password = opt.password || this._seed;
        if (!opt.password) {
            logger.warn("Missing password when import private key!");
        }

        let chainID = p[1];
        if (chainID >= 0x80000000) {
            // Hardened derivation
            chainID -= 0x80000000;
        }

        //let index = p[4];
        logger.debug("chainID=%d.", chainID);

        let iv = wanUtil.keyDerivationPBKDF2(_CIPHER_IV_MSG, 16);
        let key = wanUtil.keyDerivationPBKDF2(password, 32);

        let encrypted = wanUtil.encrypt(key, iv, privateKey.toString('hex'));
        let chainkey = this._db.read(chainID);
        if (!chainkey) {
            logger.info("Chain not exist for chainID=%d, insert new one.", chainID);
            chainkey = {
                "chainID" : chainID,
                "count" : 1,
                "keys" : {
                    0 : encrypted
                }
            }

            this._db.insert(chainkey);
            logger.info("Import private key completed!");
            return;
        }

        let index = chainkey.count;
        if (chainkey.keys.hasOwnProperty(index)) {
            logger.error(`Illogic, data corrupt: chainID=${chainID}, index=${index}!`);
            throw new error.LogicError(`Illogic, data corrupt: chainID=${chainID}, index=${index}!`);
        }
        chainkey.count = index + 1;
        chainkey.keys[index] = encrypted;

        this._db.update(chainID, chainkey);
        logger.info("Import private key completed!");
    }

    /**
     */
    size(chainID) {
        let chainkey = this._db.read(chainID);
        if (!chainkey) {
            return 0;
        }

        return chainkey.count;
    }

    _getPrivateKey(chainID, account, internal, index, opt) {
        if (chainID === null || chainID === undefined ||
            index === null || index === undefined) {
            throw new error.InvalidParameter("Missing required parameter!");
        }

        opt = opt || {};
        let forcechk = opt.forcechk || true;
        let password = opt.password;

        if (forcechk && !opt.password) {
            logger.error("Missing password when request private key!");
            throw new error.InvalidParameter("Missing password when request private key!");
        }

        if (!opt.password) {
            logger.warn("Missing password when request private key!");
        }

        logger.info(`Getting private key for chain ${chainID}, index '${index}'...`);
        let chainkey = this._db.read(chainID);
        if (!chainkey) {
            logger.error(`Key for chain ${chainID} not found!`);
            throw new error.NotFound(`Key for chain ${chainID} not found!`);
        }

        if (!chainkey.keys.hasOwnProperty(index)) {
            logger.error(`Key for chain ${chainID}, index ${index} not found!`);
            throw new error.NotFound(`Key for chain ${chainID}, index ${index} not found!`);
        }

        //if (internal) {
        //    logger.error("Internal chain not support");
        //    throw new Error("Internal chain not support");
        //}

        let encrypted = chainkey.keys[index];

        let iv = wanUtil.keyDerivationPBKDF2(_CIPHER_IV_MSG, 16);
        let key = wanUtil.keyDerivationPBKDF2(password, 32);

        let priv = wanUtil.decrypt(key, iv, encrypted);

        return Buffer.from(priv, 'hex');

    }


    /**
     * Sign raw message using SEC(Standard for Efficent Cryptography) 256k1 curve
     *
     * @param {path} string, BIP44 path to locate private to sign the message
     * @param {buf} Buffer, raw message to sign
     * @return {Object} - {r, s, v}
     */
    sec256k1sign(path, buf) {
       throw new error.NotImplemented("Not implemented");
    }
}

module.exports = RawKeyWallet;

/* eof */
