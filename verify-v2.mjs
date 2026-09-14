import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const html = fs.readFileSync('index.html', 'utf8');
const source = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const elements = new Map();
const storage = new Map();

function createElement(id = '') {
    const classes = new Set();
    return {
        id, value: '', innerHTML: '', innerText: '', textContent: '', className: '',
        style: {}, dataset: {}, children: [], clientWidth: 40, clientHeight: 40, offsetWidth: 40,
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            toggle: (name, force) => force === undefined ? (classes.has(name) ? !classes.delete(name) : Boolean(classes.add(name))) : (force ? Boolean(classes.add(name)) : !classes.delete(name)),
            contains: name => classes.has(name)
        },
        appendChild(child) { this.children.push(child); return child; },
        remove() {}, focus() {}, setSelectionRange() {}, scrollIntoView() {},
        querySelector: () => createElement(), querySelectorAll: () => [], closest: () => null,
        getElementsByClassName: () => [], getBoundingClientRect: () => ({ left: 0, top: 0 })
    };
}

const document = {
    readyState: 'complete', body: createElement('body'),
    getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
    },
    querySelector: () => createElement(), querySelectorAll: () => [], createElement
};

const location = { search: '', href: 'file:///C:/Stock/index.html' };
const context = {
    console, document, crypto: webcrypto, location, URL, URLSearchParams, Blob, Map, Set, Date, Math,
    JSON, Number, String, Array, Object, Promise, parseInt, isNaN, fetch, setTimeout, clearTimeout,
    requestAnimationFrame: callback => callback(),
    localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key)
    },
    window: { location, history: { replaceState() {} }, indexedDB: undefined }
};
context.window.document = document;
context.window.URL = URL;

const test = `
(() => {
    const migrated = JSON.parse(localStorage.getItem(APP_DATA_STORAGE_KEY));
    const originalLines = migrated.receipts.flatMap(receipt => receipt.lines);
    const forbidden = ['isExpanded', 'tempPallet', 'tempZone', 'tempQty', 'attachedPhotos'];

    document.getElementById('pr-id-input').value = 'PR-TEST-9001';
    document.getElementById('pr-item-select').value = masterItems[0].id;
    document.getElementById('pr-qty-input').value = '3';
    createPurchaseRequest();
    const newPr = purchaseRequests.find(pr => pr.number === 'PR-TEST-9001');

    document.getElementById('new-id-input').value = 'FNG-TEST-9001';
    document.getElementById('new-pr-input').value = newPr.id;
    modalRows = [{ itemId: masterItems[0].id, qty: '3', partLabel: '' }];
    createNewTransactions();
    const newReceiptRow = inventory.find(item => item.id === 'FNG-TEST-9001');
    newReceiptRow.tempPallet = 'P-TEST-1';
    newReceiptRow.tempZone = 'A';
    newReceiptRow.tempQty = '2';
    addLocation(inventory.indexOf(newReceiptRow));
    newReceiptRow.tempPallet = 'P-TEST-2';
    newReceiptRow.tempQty = '2';
    addLocation(inventory.indexOf(newReceiptRow));
    const overAssignmentBlocked = newReceiptRow.locations.length === 1;

    const saved = JSON.parse(localStorage.getItem(APP_DATA_STORAGE_KEY));
    const storedPr = saved.purchaseRequests.find(pr => pr.number === 'PR-TEST-9001');
    const storedReceipt = saved.receipts.find(receipt => receipt.number === 'FNG-TEST-9001');
    const empty = normalizeDomainData({
        schemaVersion: APP_SCHEMA_VERSION,
        categories: getDefaultCategories(), zones: getDefaultZones(), units: ['pcs'],
        items: [], purchaseRequests: [], receipts: [], assignments: [], attachments: []
    });

    globalThis.__result = {
        migration: {
            schemaVersion: migrated.schemaVersion,
            itemCount: migrated.items.length,
            prCount: migrated.purchaseRequests.length,
            receiptCount: migrated.receipts.length,
            receiptLineCount: originalLines.length,
            uniqueItemIds: new Set(migrated.items.map(item => item.id)).size === migrated.items.length,
            uniqueLineIds: new Set(originalLines.map(line => line.id)).size === originalLines.length,
            uiStatePersisted: originalLines.some(line => forbidden.some(key => key in line))
        },
        workflow: {
            prHasInternalId: storedPr.id !== storedPr.number,
            prLineHasInternalId: Boolean(storedPr.lines[0].id),
            receiptHasInternalId: storedReceipt.id !== storedReceipt.number,
            receiptReferencesPr: storedReceipt.purchaseRequestId === storedPr.id,
            assignmentReferencesLine: saved.assignments.some(assignment => assignment.receiptLineId === storedReceipt.lines[0].id && assignment.qty === 2),
            overAssignmentBlocked
        },
        emptyDataPreserved: empty.items.length === 0 && empty.purchaseRequests.length === 0 && empty.receipts.length === 0
    };
})();
`;

vm.createContext(context);
vm.runInContext(`${source}\n${test}`, context);
const reloadContext = {
    ...context,
    window: { ...context.window, history: { replaceState() {} } }
};
reloadContext.globalThis = reloadContext;
vm.createContext(reloadContext);
vm.runInContext(`${source}\n(() => {
    const pr = purchaseRequests.find(entry => entry.number === 'PR-TEST-9001');
    const receipt = inventory.find(entry => entry.id === 'FNG-TEST-9001');
    globalThis.__reloadResult = {
        prRestored: Boolean(pr && pr.items[0].qty === 3),
        receiptRestored: Boolean(receipt && receipt.prId === pr.id),
        assignmentRestored: Boolean(receipt && receipt.locations.some(location => location.pallet === 'P-TEST-1' && location.qty === 2)),
        uiStateReset: Boolean(receipt && receipt.isExpanded === false && receipt.tempPallet === '')
    };
})();`, reloadContext);
console.log(JSON.stringify({ ...context.__result, reload: reloadContext.__reloadResult }, null, 2));
