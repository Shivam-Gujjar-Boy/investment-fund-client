import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { toast } from "react-hot-toast";
import { TOKEN_METADATA_PROGRAM_ID } from "../types";
import { Metaplex } from "@metaplex-foundation/js";
import axios from "axios";
import SOL from '../assets/SOL.jpg';
import USDC from '../assets/USDC.png';

export const fetchUserTokens = async (wallet: WalletContextState, connection: Connection, metaplex: Metaplex) => {

    try {
        if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet is not connected');
        return;
        }
        const user =  wallet.publicKey;
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            user,
            {programId: TOKEN_PROGRAM_ID}
        );

        console.log(tokenAccounts);

        const tokens = tokenAccounts.value
        .map((acc) => {
            const info = acc.account.data?.parsed.info;
            const mint = info.mint;
            const balance = info.tokenAmount.uiAmount;
            const decimals = info.tokenAmount.decimals;
            let image = '';
            let name = 'Unknown';
            let symbol = 'UNKNOWN';
            if (mint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
                image = USDC;
                name = 'USDC';
                symbol = 'USDC';
            }
            return {
                pubkey: acc.pubkey,
                mint,
                name,
                symbol,
                image,
                balance,
                balance_as_usdc: balance,
                decimals
            };
        })
        .filter((token) => token.balance > 0);

        const balance = await connection.getBalance(wallet.publicKey);

        // fetch real time SOL price ------

        tokens?.unshift({
            pubkey: new PublicKey('So11111111111111111111111111111111111111111'),
            mint: 'So11111111111111111111111111111111111111111',
            name: 'SOL',
            symbol: 'SOL',
            image: SOL,
            balance: balance/Math.pow(10, 9),
            balance_as_usdc: balance,
            decimals: 9,
        });

        const tokensWithMetadata = await Promise.all(
            tokens.map(async (token) => {
                const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
                console.log(metadata?.symbol);
                return {
                    ...token,
                    symbol: metadata?.symbol || token.symbol,
                    image: metadata?.image || token.image,
                    name: metadata?.name || token.name
                };
            })
        )

        return tokensWithMetadata;
    } catch (err) {
        console.error('Error feching tokens:', err);
        return [];
    }
};

export const fetchVaultTokens = async (vault: PublicKey | undefined, connection: Connection, metaplex: Metaplex) => {

    try {
        if (!vault) return;
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            vault,
            {programId: TOKEN_PROGRAM_ID}
        );

        console.log(tokenAccounts);

        const tokens = tokenAccounts.value
        .map((acc) => {
            const info = acc.account.data?.parsed.info;
            const mint = info.mint;
            const balance = info.tokenAmount.uiAmount;
            const decimals = info.decimals;
            return {
                pubkey: acc.pubkey,
                mint,
                name: 'Unknown',
                symbol: 'UNKNOWN',
                image: '',
                balance,
                decimals,
            };
        })
        .filter((token) => token.balance > 0);

        const tokensWithMetadata = await Promise.all(
            tokens.map(async (token) => {
                const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
                return {
                    ...token,
                    symbol: metadata?.symbol || token.symbol,
                    image: metadata?.image || token.image,
                    name: metadata?.name || token.name
                };
            })
        );

        console.log(tokens);

        return tokensWithMetadata;
    } catch (err) {
        console.error('Error feching tokens:', err);
        return [];
    }
};

export const getMetadataPDA = (mintPubkey: PublicKey) => {
    return (
        PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
        )
    );
};

export const fetchMintMetadata = async (mint: PublicKey, metaplex: Metaplex) => {
    try {
        const [metadataPDA] = getMetadataPDA(mint);
        // console.log("Metadata PDA: ", metadataPDA.toBase58());
        const metadataAccountInfo = await metaplex
        .nfts()
        .findByMetadata({metadata: metadataPDA});

        // console.log("Metadata INFO: ", metadataAccountInfo);

        // console.log('metadata: ', metadataAccountInfo);
        const symbol = metadataAccountInfo.symbol;
        const uri = metadataAccountInfo.uri;
        const name = metadataAccountInfo.name;
        // console.log(name);
        let imageUri = '';
        if (uri !== '') {
            const response = await axios.get(uri);
            if (response) {
                imageUri = response.data.image;
            }
        }

        return {
            name,
            symbol,
            image: imageUri,
        };
    } catch (err) {
        console.warn('Error fetching metadata for mint: ', mint.toBase58(), err);
        return null;
    }
}