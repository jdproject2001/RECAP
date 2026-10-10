export {};

declare global {
  class PPaymentButtonBox {
    constructor(config: {
      token: string;
      clientTransactionId: string;
      amount: number;
      amountWithoutTax?: number;
      amountWithTax?: number;
      tax?: number;
      service?: number;
      tip?: number;
      currency?: string;
      storeId?: string;
      reference?: string;
      lang?: string;
      defaultMethod?: string;
      timeZone?: number;
      phoneNumber?: string;
      email?: string;
      documentId?: string;
      identificationType?: number;
    });

    render(containerId: string): void;
  }
}