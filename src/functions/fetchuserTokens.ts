import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { toast } from "react-hot-toast";
import { TOKEN_METADATA_PROGRAM_ID } from "../types";
import { Metaplex } from "@metaplex-foundation/js";

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
            return {
                pubkey: acc.pubkey,
                mint,
                symbol: 'Unknown',
                image: '',
                balance,
                decimals
            };
        })
        .filter((token) => token.balance > 0);

        const balance = await connection.getBalance(wallet.publicKey);
        tokens?.unshift({
            pubkey: new PublicKey('So11111111111111111111111111111111111111111'),
            mint: 'So11111111111111111111111111111111111111111',
            symbol: 'uwSOL',
            image: '',
            balance: balance/Math.pow(10, 9),
            decimals: 9,
        });

        const tokensWithMetadata = await Promise.all(
            tokens.map(async (token) => {
                const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
                console.log(metadata?.symbol);
                return {
                    ...token,
                    symbol: metadata?.symbol || token.symbol,
                    image: metadata?.image || token.image
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
            symbol: 'Unknown',
            image: '',
            balance,
            decimals,
            };
        })
        .filter((token) => token.balance > 0);

        const tokensWithMetadata = await Promise.all(
            tokens.map(async (token) => {
                const metadata = await fetchMintMetadata(new PublicKey(token.mint), metaplex);
                console.log(metadata?.symbol);
                return {
                    ...token,
                    symbol: metadata?.symbol || token.symbol,
                    image: metadata?.image || token.image
                };
            })
        )

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
        const metadataAccountInfo = await metaplex
        .nfts()
        .findByMetadata({metadata: metadataPDA});

        // console.log('metadata: ', metadataAccountInfo);
        const symbol = metadataAccountInfo.symbol;
        const imageUri = metadataAccountInfo.json?.image || '';

        return {
        symbol,
        image: imageUri,
        };
    } catch (err) {
        console.warn('Error fetching metadata for mint: ', mint.toBase58(), err);
        return null;
    }
}