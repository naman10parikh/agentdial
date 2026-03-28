export declare function banner(): void;
export declare function box(title: string, content: string): void;
export declare function success(msg: string): void;
export declare function error(msg: string): void;
export declare function warn(msg: string): void;
export declare function info(msg: string): void;
export declare function heading(msg: string): void;
export interface TableRow {
  [key: string]: string;
}
export declare function table(headers: string[], rows: TableRow[]): void;
//# sourceMappingURL=ui.d.ts.map
