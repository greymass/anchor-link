export interface LinkCosigner {
    account: string,
    always?: boolean,
    permission: string,
    contract: string,
    method: string,
    url?: string,
}
