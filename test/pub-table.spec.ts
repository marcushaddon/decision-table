import { PubSubTable, IDecisionTable } from "../src/model/pub-table";
import { Value } from "../src/model/value";

const getMock = (): IDecisionTable => {

    return {
        result: {
            conflicts: [],
            uncoveredConditions: [],
            redundantRules: [],
            incompleteRules: [],
            isSound: true,
        },
        state: {
            rules: [],
            ruleActions: [],
            varNames: [],
            actions: [],
        },
        addAction() { return; },
        renameAction() { return; },
        assignAction() { return; },
        addRule() { return; },
        deleteRule() { return; },
        addVar() { return; },
        deleteVar() { return; },
        setCondition() { return; },
        renameVar() { return; },
        simplify() { return; },
        simplifyRules() { return; },
        evaluate() { return (this as any).result; }
    } as unknown as IDecisionTable
};

describe("PubSubTable", () => {
    it("invokes callbacks", () => {
        const mockDt = getMock();
        const uut = new PubSubTable(mockDt);
        const cb = jest.fn();
        const sub = uut.onEvaluated(cb)
    
        uut.addRule([]);
        expect(cb).toHaveBeenCalledTimes(1);

        uut.addVar("foo");
        expect(cb).toHaveBeenCalledTimes(2);

        uut.setCondition(1, "foo", Value.T);
        expect(cb).toHaveBeenCalledTimes(3);

        uut.cancel(sub);

        uut.setCondition(1, "foo", Value.F);
        expect(cb).toHaveBeenCalledTimes(3);
    });
});
