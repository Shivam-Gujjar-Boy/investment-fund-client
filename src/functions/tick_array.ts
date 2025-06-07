import {Connection, PublicKey} from '@solana/web3.js';

export async function findTickArrayAccounts(pool_id: PublicKey) {
    try {
        // if (!process.env.SOLANA_RPC_URL_MAINNET) {
        //     throw Error(`Gaand ke pille DEVNET rpc url dede tameej me, nahi to gandiya ke chhidde chaude kar diye jayenge`);
        // }

        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        // const programId = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
        const programId = new PublicKey('devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH');
        const dataSize = 10240;
        console.log(`Fetching Tick Array accounts owned by Raydium's CLMM program, size 10240 bytes`);
        // const pool_id = new PublicKey('ECod6BDYQ5YmjXGPTr3uRXWRtvdPhC9kctwJavywbEMP');
        // const pool_id = new PublicKey('GVTQ1LZVrRqYByjV9dgdZftd93kDBLUp6ub39wdoTi2T');
        // const pool_id = new PublicKey('B5B7sNMnbs5Xru5PfeS3NY1kDKYJK2ym63mWeC8tNWm6');
        const accounts = await connection.getProgramAccounts(programId, {
            filters: [
                {dataSize},
                {
                    memcmp: {
                        offset: 8,
                        bytes: pool_id.toBase58(),
                    },
                },
                // {
                //     memcmp: {
                //         offset: 10124,
                //         bytes: Buffer.from([60]),
                //     }
                // },
            ],
            dataSlice: {offset: 0, length: 0},
            commitment: 'confirmed'
        });

        if (accounts.length === 0) {
            console.log('No tick Array accounts found');
        }
        const ticks: PublicKey[] = []; 
        for (const acc of accounts) {
            console.log('Tick Array Account:     ', acc.pubkey.toBase58());
            ticks.push(acc.pubkey);
        }

        return ticks;
    } catch (err) {
        console.log(err);
        // return err;
    }
}
// findTickArrayAccounts();