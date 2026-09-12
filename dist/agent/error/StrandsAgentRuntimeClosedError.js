export class StrandsAgentRuntimeClosedError extends Error {
    constructor() {
        super('The Strands agent runtime is closed and cannot accept new work.');
        this.name = 'StrandsAgentRuntimeClosedError';
    }
}
//# sourceMappingURL=StrandsAgentRuntimeClosedError.js.map