import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import { Fund, programId } from "../types";
import { Buffer } from "buffer";

export async function extractFundData (fundAccountInfo: AccountInfo<Buffer<ArrayBufferLike>> | null, connection: Connection) {
    if (!fundAccountInfo) return null;
    const fund_buffer = Buffer.from(fundAccountInfo.data);
    const name_dummy = fund_buffer.slice(0, 27).toString();
    let name = '';
    for (const c of name_dummy) {
        if (c === '\x00') break;
        name += c;
    }
    const isRefunded = fund_buffer.readUInt8(26) ? true : false;
    const expectedMembers = fund_buffer.readUInt32LE(27);
    const creatorExists = fund_buffer.readUInt8(31) ? true : false;
    const totalDeposit = fund_buffer.readBigInt64LE(32);
    const governanceMint = new PublicKey(fund_buffer.slice(40, 72));
    const vault = new PublicKey(fund_buffer.slice(72, 104));
    const currentIndex = fund_buffer.readUInt8(104);
    const created_at = fund_buffer.readBigInt64LE(105);
    const is_private = fund_buffer.readUInt8(113);
    const numOfMembers = fund_buffer.readUInt32LE(114);
    const members: PublicKey[] = [];
    for (let i=0; i<numOfMembers; i++) {
        members.push(new PublicKey(fund_buffer.slice(118+i*32, 150+i*32)));
    }
    const creator = new PublicKey(fund_buffer.slice(118, 150));

    const [fund_address] = PublicKey.findProgramAddressSync(
        [Buffer.from('fund'), Buffer.from(name)],
        programId
    );

    const [incrementProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('increment-proposal-account'), fund_address.toBuffer()],
        programId
    );

    let underIncrementation = false;
    let incrementProposer;
    const incrementProposalInfo = await connection.getAccountInfo(incrementProposalPda);
    if (!incrementProposalInfo) {
        underIncrementation = false;
        incrementProposer = fund_address;
    } else {
        const incrementBuffer = Buffer.from(incrementProposalInfo.data);
        underIncrementation = true;
        incrementProposer = new PublicKey(incrementBuffer.slice(0, 32));
    }

    const fund: Fund = {
        fund_address,
        name,
        expectedMembers,
        creatorExists,
        creator,
        numOfMembers,
        members,
        totalDeposit,
        governanceMint,
        vault,
        currentIndex,
        created_at,
        is_private,
        underIncrementation,
        incrementProposer,
        isRefunded
    };

    return fund;
}