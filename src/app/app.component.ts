import { Component } from '@angular/core';
import algosdk from 'algosdk';
import MyAlgoConnect from '@randlabs/myalgo-connect';
import { environment } from 'src/environments/environment';
import { Buffer } from 'buffer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  address = '';
  mintedNftsIds: string[] = [];
  myAlgoConnect: MyAlgoConnect;
  algodClient: algosdk.Algodv2;

  constructor() {
    const myAlgoConnect = new MyAlgoConnect({
      disableLedgerNano: false,
    });
    const algodClient = new algosdk.Algodv2(
      environment.algodClient.token,
      environment.algodClient.server,
      environment.algodClient.port
    );
    this.myAlgoConnect = myAlgoConnect;
    this.algodClient = algodClient;
  }

  copyToClipboard(htmlElement: HTMLElement) {
    const range = document.createRange();
    range.selectNode(document.getElementById(htmlElement.id) as Node);
    window.getSelection()?.removeAllRanges(); // clear current selection
    window.getSelection()?.addRange(range); // select range
    document.execCommand('copy');
    window.getSelection()?.removeAllRanges(); // deselect selected range
  }

  async connect(): Promise<void> {
    try {
      const accountsSharedByUser = await this.myAlgoConnect.connect({
        shouldSelectOneAccount: true,
      });
      this.address = accountsSharedByUser[0].address;
    } catch (e) {
      alert(e);
    }
  }

  async mint(
    nftsAmount: string,
    managerAddress: string,
    metadataCid: string,
    templateIpfsUrl: string
  ) {
    try {
      const params = await this.algodClient.getTransactionParams().do();

      const txns: algosdk.Transaction[] = [];
      for (let id = 0; id < parseInt(nftsAmount); id++) {
        const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
          suggestedParams: {
            ...params,
          },
          from: this.address,
          assetName: 'Trantorian NFT' + id,
          unitName: 'TR' + id,
          total: 1,
          decimals: 0,
          defaultFrozen: false,
          reserve: metadataCid,
          manager: managerAddress,
          assetURL: templateIpfsUrl,
        });
        txns.push(txn);
      }

      const signedTxns = await this.signTransactions(txns);
      this.castTransactions(signedTxns);
      this.waiteForOperationsConfirmation(txns);
    } catch (e) {
      alert(e);
    }
  }

  private async signTransactions(
    txns: algosdk.Transaction[]
  ): Promise<string[]> {
    const signedTxns = await this.myAlgoConnect.signTxns(
      txns.map((txn) => ({
        txn: Buffer.from(txn.toByte()).toString('base64'),
      }))
    );
    return signedTxns as string[];
  }

  private async castTransactions(signedTxns: string[]) {
    const txnsBytes = signedTxns.map((signedTxn) =>
      Buffer.from(signedTxn as string, 'base64')
    );
    txnsBytes.forEach((txnBytes) =>
      this.algodClient.sendRawTransaction(txnBytes).do()
    );
  }

  private async waiteForOperationsConfirmation(
    txns: algosdk.Transaction[]
  ): Promise<void> {
    const confirmedOperationsPromises = txns.map((txn) =>
      algosdk.waitForConfirmation(this.algodClient, txn.txID(), 4)
    );
    const confirmedOperations = await Promise.all(confirmedOperationsPromises);
    this.cleanNftsIds();
    this.retrieveMintedNftsIds(confirmedOperations);
  }

  private cleanNftsIds() {
    this.mintedNftsIds = [];
  }

  private retrieveMintedNftsIds(confirmedOperations: Record<string, any>[]) {
    confirmedOperations.forEach((confirmedOperation) => {
      this.mintedNftsIds.push(confirmedOperation['asset-index']);
    });
  }
}
