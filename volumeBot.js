const solanaWeb3 = require("@solana/web3.js");
const fs = require("fs");
const { swap, getSwapInfo } = require("@raydium-io/raydium-sdk"); // Assuming getSwapInfo is the correct method

// Load the wallet keypairs from files
const masterWallet = JSON.parse(
  fs.readFileSync(
    "/Users/olajide/documents/solana-volume-bot/master-wallet.json",
    "utf8"
  )
);
const makerWallet1 = JSON.parse(
  fs.readFileSync(
    "/Users/olajide/documents/solana-volume-bot/maker-wallet1.json",
    "utf8"
  )
);
const makerWallet2 = JSON.parse(
  fs.readFileSync(
    "/Users/olajide/documents/solana-volume-bot/maker-wallet2.json",
    "utf8"
  )
);
const makerWallet3 = JSON.parse(
  fs.readFileSync(
    "/Users/olajide/documents/solana-volume-bot/maker-wallet3.json",
    "utf8"
  )
);

// Create wallet objects
const masterKeypair = solanaWeb3.Keypair.fromSecretKey(
  Uint8Array.from(masterWallet)
);
const makerKeypair1 = solanaWeb3.Keypair.fromSecretKey(
  Uint8Array.from(makerWallet1)
);
const makerKeypair2 = solanaWeb3.Keypair.fromSecretKey(
  Uint8Array.from(makerWallet2)
);
const makerKeypair3 = solanaWeb3.Keypair.fromSecretKey(
  Uint8Array.from(makerWallet3)
);

// Connect to the Solana Mainnet
const connection = new solanaWeb3.Connection(
  solanaWeb3.clusterApiUrl("mainnet-beta"), // Connect to mainnet-beta
  "confirmed"
);

// Implement the getTokenAccount function using getParsedTokenAccountsByOwner
async function getTokenAccount(connection, owner, tokenAddress) {
  const mintPubkey = new solanaWeb3.PublicKey(tokenAddress);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    mint: mintPubkey,
  });

  // Return the first token account if it exists
  return tokenAccounts.value.length > 0 ? tokenAccounts.value[0].pubkey : null;
}

// Implement the performTrade function
async function performTrade(buyer, seller, tokenAddress) {
  try {
    // Fetch buyer and seller token accounts
    const buyerTokenAccount = await getTokenAccount(
      connection,
      buyer.publicKey,
      tokenAddress
    );
    const sellerTokenAccount = await getTokenAccount(
      connection,
      seller.publicKey,
      tokenAddress
    );

    // Fetch Raydium swap information
    const swapInfo = await getSwapInfo(tokenAddress); // Fetch appropriate swap info

    // Create transaction
    const transaction = new solanaWeb3.Transaction();
    const swapInstruction = swap({
      connection,
      user: buyer.publicKey,
      userSource: buyerTokenAccount,
      userDestination: sellerTokenAccount,
      swapInfo,
    });

    // Add the swap instruction to the transaction
    transaction.add(swapInstruction);

    // Sign and send the transaction
    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transaction,
      [buyer]
    );
    console.log(`Trade successful! Signature: ${signature}`);
  } catch (error) {
    console.error("Error during trading:", error);
  }
}

// Main transaction loop with rate-limiting
async function transactionLoop() {
  let delay = 5000; // Initial delay
  while (true) {
    try {
      // Perform a buy/sell operation between maker wallets
      await performTrade(
        makerKeypair1,
        makerKeypair2,
        "6zAVwSFowp8Mqi4gex1GxjPdWQgZA3pGmaUaVXftrUMp"
      );
      await performTrade(
        makerKeypair2,
        makerKeypair3,
        "6zAVwSFowp8Mqi4gex1GxjPdWQgZA3pGmaUaVXftrUMp"
      );

      // Reset delay if successful
      delay = 5000;
    } catch (error) {
      if (error.message.includes("429 Too Many Requests")) {
        console.log(`429 Error, backing off for ${delay / 1000} seconds`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Increase the delay after hitting the rate limit
      } else {
        console.error("Unexpected error:", error);
        throw error; // For other errors, rethrow
      }
    }

    // Pause before the next loop iteration
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// Start the transaction loop
transactionLoop();
