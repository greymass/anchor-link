import * as assert from 'assert'
import 'mocha'

import {sealMessage} from '../src/utils'
import {PrivateKey, UInt64} from '@greymass/eosio'

suite('aes', function () {
    test('seal message', function () {
        const k1 = PrivateKey.from('5KGNiwTYdDWVBc9RCC28hsi7tqHGUsikn9Gs8Yii93fXbkYzxGi')
        const k2 = PrivateKey.from('5Kik3tbLSn24ScHFsj6GwLkgd1H4Wecxkzt1VX7PBBRDQUCdGFa')
        const sealed = sealMessage(
            'The hovercraft is full of eels',
            k1,
            k2.toPublic(),
            UInt64.from(42)
        )
        assert.equal(
            sealed.ciphertext.hexString,
            'a26b34e0fe70e2d624da9fddf3ba574c5b827d729d0edc172641f44ea3739ab0'
        )
        assert.equal(sealed.checksum.toString(), '2660735416')
    })
})
