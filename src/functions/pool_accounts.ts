import {Connection, PublicKey} from '@solana/web3.js';

// config();

export async function findAmmConfig() {
    try {
        // if (!process.env.SOLANA_RPC_URL_MAINNET) {
        //     throw Error(`Gaand ke pille DEVNET rpc url dede tameej me, nahi to gandiya ke chhidde cahude kar diye jayenge`);
        // }

        const connection = new Connection("https://api.devnet.solana.com", 'confirmed');

        // const programId = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
        const programId = new PublicKey('devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH');
        const dataSize = 1544;
        const solMint = new PublicKey('So11111111111111111111111111111111111111112');
        // const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        // const btrumpMint = new PublicKey('84fb2MuMr6e2ziwqNJRwZqovFmnwTVdUXjxuLh3Fpump');
        // const holdMint = new PublicKey('2556xFm2EJNiyQCUw984vaD5Duic7VZtpmPWY2Babonk');
        const usdcMint = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
        console.log(`Fetching AmmConfig accounts owned by Raydium's CLMM program, size 1544 bytes`);

        const accounts = await connection.getProgramAccounts(programId, {
            filters: [
                {dataSize},
                {
                    memcmp: {
                        offset: 73,
                        bytes: solMint.toBase58()
                    },
                },
                {
                    memcmp: {
                        offset: 105,
                        bytes: usdcMint.toBase58()
                    },
                },
            ],
            dataSlice: {offset: 0, length: 0},
            commitment: 'confirmed',
        });

        if (accounts.length === 0) {
            console.log(`No pool accounts found with for pair SOL/USDC`);
        }

        let max_liquidity: bigint = BigInt(0);
        let pool = accounts[0];

        for (const acc of accounts) {
            // console.log("CPMM Pool Account Pubkey for SOL/HOLD:      ", acc.pubkey.toBase58(), "------------>");
            const accountInfo = await connection.getAccountInfo(acc.pubkey, 'confirmed');
            if (!accountInfo) return;
            const buffer = Buffer.from(accountInfo.data);
            const offset = 122;
            const liquidityy = readU128LE(buffer, offset);

            if (liquidityy > max_liquidity ) {
                max_liquidity=liquidityy;
                pool=acc;
            }
        }
        console.log("pool: ", pool.pubkey.toBase58());

        const accounts_arr = [];
        // const pool_info = await connection.getAccountInfo(pool.pubkey, 'confirmed');
        const pool_info = await connection.getAccountInfo(new PublicKey('GBNzmD4w2TJeDnPJhwBoLWAy3xjxHR9XRBMo2MKuTUcK'), 'confirmed');
        if (!pool_info) return;
        const buffer = Buffer.from(pool_info.data);
        const ammInfo = new PublicKey(buffer.slice(9, 41));
        accounts_arr.push(ammInfo);
        // accounts_arr.push(pool.pubkey);
        accounts_arr.push(new PublicKey('GBNzmD4w2TJeDnPJhwBoLWAy3xjxHR9XRBMo2MKuTUcK'));
        const token0Vault = new PublicKey(buffer.slice(137, 169));
        accounts_arr.push(token0Vault);
        const token1Vault = new PublicKey(buffer.slice(169, 201));
        accounts_arr.push(token1Vault);
        const obsKey = new PublicKey(buffer.slice(201, 233));
        accounts_arr.push(obsKey);

        const [tickArrayBitmapAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from('pool_tick_array_bitmap_extension'), (new PublicKey('GBNzmD4w2TJeDnPJhwBoLWAy3xjxHR9XRBMo2MKuTUcK')).toBuffer()],
            programId
        );

        accounts_arr.push(tickArrayBitmapAccount);

        return accounts_arr;



        // for (const acc of accounts) {
            
        //     console.log("CPMM Pool Account Pubkey for SOL/HOLD:      ", acc.pubkey.toBase58(), "------------>");
        //     const accountInfo = await connection.getAccountInfo(acc.pubkey, 'confirmed');
        //     const buffer = Buffer.from(accountInfo.data);
        //     const ammInfo = new PublicKey(buffer.slice(9, 41)).toBase58();
        //     const token0Vault = new PublicKey(buffer.slice(137, 169)).toBase58();;
        //     const token1Vault = new PublicKey(buffer.slice(169, 201)).toBase58();
        //     // const token0Program = new PublicKey(buffer.slice(232, 264)).toBase58();
        //     // const token1Program = new PublicKey(buffer.slice(264, 296)).toBase58();
        //     const obsKey = new PublicKey(buffer.slice(201, 233)).toBase58();
        //     console.log('Amm Config is:    ', ammInfo);
        //     console.log('Token 0 Vault:    ', token0Vault);
        //     console.log('Token 1 Vault:    ', token1Vault);
        //     // console.log('Token 0 Program:  ', token0Program);
        //     // console.log('Token 1 Program:  ', token1Program);
        //     console.log('Observation Key:  ', obsKey);
        //     console.log('-----------------------------------------');
        // }
    } catch (err) {
        console.log(err);
    }
}

function readU128LE(buffer: Buffer<ArrayBuffer>, offset: number) {
    const low = buffer.readBigUInt64LE(offset);         // Lower 64 bits
    const high = buffer.readBigUInt64LE(offset + 8);     // Higher 64 bits
    return (high << 64n) + low;
}

// findAmmConfig();