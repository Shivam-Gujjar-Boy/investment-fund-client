import {config} from 'dotenv';
import {Connection, PublicKey} from '@solana/web3.js';
// import bs58 from 'bs58';

config();

async function findAmmConfig() {
    try {
        // if (!process.env.SOLANA_RPC_URL_MAINNET) {
        //     throw Error(`Gaand ke pille DEVNET rpc url dede tameej me, nahi to gandiya ke chhidde cahude kar diye jayenge`);
        // }

        const connection = new Connection("https://api.devnet.solana.com", 'confirmed');

        const programId = new PublicKey('devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH');
        // const programId = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
        const dataSize = 117;
        console.log(`Fetching AmmConfig accounts owned by Raydium's CLMM program, size 117 bytes`);

        // const buf = Buffer.alloc(2);
        for (let index = 30; index < 31; index++) {
            // const buf = Buffer.alloc(2);
            // buf.writeUInt16LE(index);
            const accounts = await connection.getProgramAccounts(programId, {
                filters: [
                    {dataSize},
                    // {
                    //     memcmp: {
                    //         offset: 9,
                    //         bytes: bs58.encode(buf)
                    //     }
                    // }
                ],
                dataSlice: {offset: 0, length: 0},
                commitment: 'confirmed',
            });

            if (accounts.length === 0) {
                // console.log(`No accounts found with index ${index}`);
                console.log('No AMM Config accounts found with size 177 bytes');
            }

            for (const acc of accounts) {
                console.log("AMM Config Account Pubkey:      ", acc.pubkey.toBase58(), "     ",index);
            }
        }
    } catch (err) {
        console.log(err.message);
    }
}
findAmmConfig();