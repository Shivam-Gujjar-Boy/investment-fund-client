import { Fund } from "../types";

export function printFundDetails (fund: Fund) {
    console.log('Fund pubkey: ', fund.fund_address.toBase58());
    console.log('Fund Name: ', fund.name);
    console.log('Creator: ', fund.creator.toBase58());
    console.log('Number of members: ', fund.numOfMembers);
    for (let i=0; i<fund.numOfMembers; i++) {
        console.log('Member ', (i+1), ' ', fund.members[i].toBase58());
    }
    console.log('Total deposit: ', fund.totalDeposit);
    console.log('Governance Mint: ', fund.governanceMint.toBase58());
    console.log('Vauly Address: ', fund.vault.toBase58());
    console.log('Current Proposal Index: ', fund.currentIndex);
    console.log('Created At: ', fund.created_at);
    console.log('Is private: ', fund.is_private);
}