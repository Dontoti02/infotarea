/* eslint-disable @typescript-eslint/no-explicit-any -- shim mínimo: los tipos oficiales de `pg` no están instalados en este entorno. */
declare module 'bcrypt';

declare module 'pg' {
  /* Declaración mínima mientras no estén instalados los tipos oficiales de `pg`. */
  export interface QueryResult<R = any> {
    rows: R[];
    rowCount: number | null;
  }
  export interface ClientConfig {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }
  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<R = any>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
  }
}
