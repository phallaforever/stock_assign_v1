const INVENTORY_STORAGE_KEY = 'stock-received-inventory-v1';
const ITEM_MASTER_STORAGE_KEY = 'stock-received-item-master-v1';
const PR_STORAGE_KEY = 'stock-received-pr-list-v1';
const APP_DATA_STORAGE_KEY = 'stock-assign-domain-v2';
const APP_SCHEMA_VERSION = 2;
const PHOTO_DB_NAME = 'stock-assign-attachments';
const PHOTO_STORE_NAME = 'photos';
const defaultInventory = [
    {
        id: 'FNG-1',
        pr: 'PR-8821',
        createdAt: '2026-06-01 08:30',
        item: 'Aluminum frame — matte black',
        qty: 120,
        isExpanded: true,
        locations: [{ pallet: 'P-101', zone: 'A', qty: 44, createdAt: '2026-06-01 09:15' }],
        attachedPhotos: [],
        tempZone: 'A'
    },
    {
        id: 'FNG-1',
        pr: 'PR-8821',
        createdAt: '2026-06-01 08:30',
        item: 'Rubber sealing gasket 10m',
        qty: 50,
        isExpanded: false,
        locations: [],
        attachedPhotos: [],
        tempZone: 'A'
    },
    {
        id: 'FNG-2',
        pr: 'PR-8822',
        createdAt: '2026-06-02 10:14',
        item: 'Tempered glass panel 8mm',
        qty: 64,
        isExpanded: false,
        locations: [{ pallet: 'P-102', zone: 'B', qty: 5, createdAt: '2026-06-02 11:00' }],
        attachedPhotos: [],
        tempZone: 'A'
    },
    {
        id: 'FNG-3',
        pr: 'PR-8825',
        createdAt: '2026-06-03 14:20',
        item: 'Window handle set',
        qty: 45,
        isExpanded: false,
        locations: [{ pallet: 'P-103', zone: 'Loading', qty: 5, createdAt: '2026-06-03 14:45' }],
        attachedPhotos: [],
        tempZone: 'A'
    }
];

let inventory = loadInventory();
const legacyInventory = inventory;
let masterItems = loadMasterItems();
const legacyMasterItems = masterItems;
let purchaseRequests = loadPurchaseRequests();
const legacyPurchaseRequests = purchaseRequests;
let appData = loadOrMigrateDomainData(legacyInventory, legacyMasterItems, legacyPurchaseRequests);
masterItems = hydrateMasterItems(appData);
purchaseRequests = hydratePurchaseRequests(appData);
inventory = hydrateInventory(appData, masterItems, purchaseRequests);
let pendingAction = null;
let modalRows = [];
let prModalRows = [];
let prModalMode = 'create';
let prModalTargetId = '';
const expandedPrIds = new Set();
let toastTimer = null;
let searchQuery = '';
const validZones = appData.zones.map(zone => zone.code);
const validViewIds = ['dashboard', 'stock', 'report', 'items', 'prs'];
const requestedView = new URLSearchParams(window.location.search).get('view');
let currentView = validViewIds.includes(requestedView) ? requestedView : 'dashboard';
let reportFilters = { pr: '', zone: '', status: '' };
let itemMasterFilters = { search: '', category: '', type: '' };
let editingItemId = null;
let openItemActionMenuId = null;
const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'stock', label: 'Stock Received' },
    { id: 'report', label: 'Report' },
    { id: 'items', label: 'Item Master' },
    { id: 'prs', label: 'PR List' }
];

function cloneDefaultInventory() {
    return JSON.parse(JSON.stringify(defaultInventory));
}

function normalizeInventory(savedInventory) {
    if (!Array.isArray(savedInventory)) return cloneDefaultInventory();

    return savedInventory.map((item, index) => ({
        id: item.id || `FNG-${index + 1}`,
        pr: item.pr || '',
        createdAt: item.createdAt || getCurrentFormattedDateTime(),
        itemId: item.itemId || '',
        item: item.item || 'Untitled item',
        partLabel: item.partLabel || '',
        partsPerSet: Number.parseInt(item.partsPerSet || 1, 10) || 1,
        qty: Number.parseInt(item.qty, 10) || 0,
        isExpanded: Boolean(item.isExpanded),
        locations: Array.isArray(item.locations) ? item.locations.map(loc => ({
            pallet: loc.pallet || '',
            zone: loc.zone || 'A',
            qty: Number.parseInt(loc.qty, 10) || 0,
            createdAt: loc.createdAt || ''
        })) : [],
        attachedPhotos: Array.isArray(item.attachedPhotos) ? item.attachedPhotos : [],
        tempPallet: item.tempPallet || '',
        tempZone: item.tempZone || 'A',
        tempQty: item.tempQty || ''
    }));
}

function loadInventory() {
    try {
        const savedInventory = localStorage.getItem(INVENTORY_STORAGE_KEY);
        if (!savedInventory) return cloneDefaultInventory();
        return normalizeInventory(JSON.parse(savedInventory));
    } catch (error) {
        console.warn('Unable to load saved inventory:', error);
        return cloneDefaultInventory();
    }
}

function saveInventory() {
    return saveDomainState();
}

function buildDefaultMasterItems() {
    const byName = new Map();
    inventory.forEach(item => {
        const name = (item.item || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!byName.has(key)) {
            byName.set(key, {
                id: `ITEM-${String(byName.size + 1).padStart(3, '0')}`,
                name,
                sku: `SKU-${String(byName.size + 1).padStart(3, '0')}`,
                unit: 'pcs',
                category: 'General',
                itemType: 'Single',
                partsPerSet: 1
            });
        }
    });
    return Array.from(byName.values());
}

function normalizeMasterItems(items) {
    if (!Array.isArray(items)) return buildDefaultMasterItems();
    return items.map((item, index) => ({
        id: item.id || `ITEM-${String(index + 1).padStart(3, '0')}`,
        name: item.name || item.item || 'Untitled item',
        sku: item.sku || `SKU-${String(index + 1).padStart(3, '0')}`,
        unit: item.unit || 'pcs',
        category: item.category || 'General',
        itemType: item.itemType || (Number.parseInt(item.partsPerSet || 1, 10) > 1 ? 'Set' : 'Single'),
        partsPerSet: Number.parseInt(item.partsPerSet || 1, 10) || 1
    }));
}

function loadMasterItems() {
    try {
        const savedItems = localStorage.getItem(ITEM_MASTER_STORAGE_KEY);
        return normalizeMasterItems(savedItems ? JSON.parse(savedItems) : null);
    } catch (error) {
        console.warn('Unable to load item master:', error);
        return buildDefaultMasterItems();
    }
}

function saveMasterItems() {
    return saveDomainState();
}

function findMasterItemByName(name) {
    return masterItems.find(item => item.name.toLowerCase() === String(name || '').toLowerCase());
}

function findMasterItemById(itemId) {
    return masterItems.find(item => item.id === itemId);
}

function getPartLabels(partsPerSet) {
    const count = Math.max(1, Number.parseInt(partsPerSet || 1, 10) || 1);
    return Array.from({ length: count }, (_, index) => `${index + 1}/${count}`);
}

function getReceivedEntriesForPrLine(prId, line) {
    const prNumber = purchaseRequests.find(pr => pr.id === prId)?.number || prId;
    return inventory.filter(item => {
        const samePr = item.prId === prId || (item.pr || '') === prNumber;
        const sameItem = line.itemId ? item.itemId === line.itemId : item.item === line.itemName;
        return samePr && sameItem;
    });
}

function getReceivedSetsForPrLine(prId, line) {
    const partsPerSet = Number.parseInt(line.partsPerSet || 1, 10) || 1;
    const entries = getReceivedEntriesForPrLine(prId, line);
    if (partsPerSet <= 1) {
        return entries.reduce((sum, item) => sum + (Number.parseInt(item.qty || 0, 10) || 0), 0);
    }

    const partTotals = getPartLabels(partsPerSet).map(partLabel => {
        return entries
            .filter(item => item.partLabel === partLabel)
            .reduce((sum, item) => sum + (Number.parseInt(item.qty || 0, 10) || 0), 0);
    });

    return partTotals.length ? Math.min(...partTotals) : 0;
}

function getAssignedSetsForPrLine(prId, line) {
    const partsPerSet = Number.parseInt(line.partsPerSet || 1, 10) || 1;
    const entries = getReceivedEntriesForPrLine(prId, line);
    if (partsPerSet <= 1) {
        return entries.reduce((sum, item) => sum + totalAbbr(item), 0);
    }
    const partTotals = getPartLabels(partsPerSet).map(partLabel => {
        return entries
            .filter(item => item.partLabel === partLabel)
            .reduce((sum, item) => sum + totalAbbr(item), 0);
    });
    return partTotals.length ? Math.min(...partTotals) : 0;
}

function buildDefaultPurchaseRequests() {
    const grouped = new Map();
    inventory.forEach(stock => {
        const pr = stock.pr || 'No PR';
        const masterItem = findMasterItemByName(stock.item);
        if (!grouped.has(pr)) {
            grouped.set(pr, {
                id: pr,
                createdAt: stock.createdAt || getCurrentFormattedDateTime(),
                status: 'Open',
                items: []
            });
        }
        grouped.get(pr).items.push({
            itemId: masterItem ? masterItem.id : '',
            itemName: stock.item,
            qty: Number.parseInt(stock.qty || 0, 10) || 0,
            itemType: masterItem ? masterItem.itemType : 'Single',
            partsPerSet: masterItem ? masterItem.partsPerSet : 1
        });
    });
    return Array.from(grouped.values());
}

function normalizePurchaseRequests(prs) {
    if (!Array.isArray(prs)) return buildDefaultPurchaseRequests();
    return prs.map((pr, index) => ({
        id: pr.id || pr.pr || `PR-${String(index + 1).padStart(4, '0')}`,
        createdAt: pr.createdAt || getCurrentFormattedDateTime(),
        status: pr.status || 'Open',
        items: Array.isArray(pr.items) ? pr.items.map(line => ({
            itemId: line.itemId || '',
            itemName: line.itemName || line.item || 'Untitled item',
            qty: Number.parseInt(line.qty || 0, 10) || 0,
            itemType: line.itemType || (Number.parseInt(line.partsPerSet || 1, 10) > 1 ? 'Set' : 'Single'),
            partsPerSet: Number.parseInt(line.partsPerSet || 1, 10) || 1
        })) : []
    }));
}

function loadPurchaseRequests() {
    try {
        const savedPrs = localStorage.getItem(PR_STORAGE_KEY);
        return normalizePurchaseRequests(savedPrs ? JSON.parse(savedPrs) : null);
    } catch (error) {
        console.warn('Unable to load PR list:', error);
        return buildDefaultPurchaseRequests();
    }
}

function savePurchaseRequests() {
    return saveDomainState();
}

function createEntityId(prefix) {
    const value = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${value}`;
}

function getNextDocumentNumber(prefix, existingNumbers) {
    const highest = existingNumbers.reduce((max, value) => {
        const match = String(value || '').match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
        return match ? Math.max(max, Number.parseInt(match[1], 10) || 0) : max;
    }, 0);
    return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}

function toIsoDateTime(value) {
    if (!value) return new Date().toISOString();
    const parsed = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function formatDomainDateTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value || '');
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getDefaultCategories() {
    return ['Aluminum', 'Frame', 'Glass', 'Hardware', 'Sealant', 'General'].map(name => ({
        id: name.toLowerCase(),
        name,
        isActive: true
    }));
}

function getDefaultZones() {
    return ['A', 'B', 'C', 'D', 'E', 'Loading'].map(code => ({
        id: `zone-${code.toLowerCase()}`,
        code,
        name: code === 'Loading' ? 'Loading' : `Zone ${code}`,
        isActive: true
    }));
}

function normalizeDomainData(data) {
    const categories = Array.isArray(data.categories) && data.categories.length ? data.categories : getDefaultCategories();
    const categoryIds = new Set(categories.map(category => category.id));
    const items = Array.isArray(data.items) ? data.items.map(item => ({
        id: item.id || createEntityId('item'),
        sku: item.sku || '',
        name: item.name || 'Untitled item',
        categoryId: categoryIds.has(item.categoryId) ? item.categoryId : 'general',
        unit: item.unit || 'pcs',
        itemType: item.itemType === 'Set' ? 'Set' : 'Single',
        partsPerSet: Math.max(1, Number.parseInt(item.partsPerSet || 1, 10) || 1),
        isActive: item.isActive !== false,
        createdAt: toIsoDateTime(item.createdAt),
        updatedAt: toIsoDateTime(item.updatedAt || item.createdAt)
    })) : [];

    const purchaseRequests = Array.isArray(data.purchaseRequests) ? data.purchaseRequests.map(pr => ({
        id: pr.id || createEntityId('pr'),
        number: pr.number || pr.id || 'PR-Unnumbered',
        workflowStatus: pr.workflowStatus || 'open',
        createdAt: toIsoDateTime(pr.createdAt),
        updatedAt: toIsoDateTime(pr.updatedAt || pr.createdAt),
        lines: Array.isArray(pr.lines) ? pr.lines.map(line => ({
            id: line.id || createEntityId('pr-line'),
            itemId: line.itemId || '',
            orderedQty: Math.max(0, Number.parseInt(line.orderedQty || line.qty || 0, 10) || 0),
            unit: line.unit || line.itemSnapshot?.unit || 'pcs',
            itemSnapshot: {
                sku: line.itemSnapshot?.sku || '',
                name: line.itemSnapshot?.name || line.itemName || 'Untitled item',
                unit: line.itemSnapshot?.unit || line.unit || 'pcs',
                itemType: line.itemSnapshot?.itemType === 'Set' ? 'Set' : 'Single',
                partsPerSet: Math.max(1, Number.parseInt(line.itemSnapshot?.partsPerSet || line.partsPerSet || 1, 10) || 1)
            }
        })) : []
    })) : [];

    const receipts = Array.isArray(data.receipts) ? data.receipts.map(receipt => ({
        id: receipt.id || createEntityId('receipt'),
        number: receipt.number || 'FNG-Unnumbered',
        purchaseRequestId: receipt.purchaseRequestId || '',
        workflowStatus: receipt.workflowStatus || 'posted',
        receivedAt: toIsoDateTime(receipt.receivedAt),
        lines: Array.isArray(receipt.lines) ? receipt.lines.map(line => ({
            id: line.id || createEntityId('receipt-line'),
            prLineId: line.prLineId || '',
            itemId: line.itemId || '',
            itemSnapshot: {
                sku: line.itemSnapshot?.sku || '',
                name: line.itemSnapshot?.name || line.itemName || 'Untitled item',
                unit: line.itemSnapshot?.unit || 'pcs',
                partsPerSet: Math.max(1, Number.parseInt(line.itemSnapshot?.partsPerSet || line.partsPerSet || 1, 10) || 1)
            },
            partNumber: Math.max(0, Number.parseInt(line.partNumber || 0, 10) || 0),
            receivedQty: Math.max(0, Number.parseInt(line.receivedQty || line.qty || 0, 10) || 0),
            quantityUnit: line.quantityUnit || 'pcs'
        })) : []
    })) : [];

    return {
        schemaVersion: APP_SCHEMA_VERSION,
        updatedAt: toIsoDateTime(data.updatedAt),
        categories,
        units: Array.isArray(data.units) && data.units.length ? data.units : ['pcs', 'set', 'box', 'm', 'kg'],
        zones: Array.isArray(data.zones) && data.zones.length ? data.zones : getDefaultZones(),
        items,
        purchaseRequests,
        receipts,
        assignments: Array.isArray(data.assignments) ? data.assignments.map(assignment => ({
            id: assignment.id || createEntityId('assignment'),
            receiptLineId: assignment.receiptLineId || '',
            palletCode: assignment.palletCode || assignment.pallet || '',
            zoneId: assignment.zoneId || assignment.zone || 'A',
            qty: Math.max(0, Number.parseInt(assignment.qty || 0, 10) || 0),
            quantityUnit: assignment.quantityUnit || 'pcs',
            assignedAt: toIsoDateTime(assignment.assignedAt || assignment.createdAt)
        })) : [],
        attachments: Array.isArray(data.attachments) ? data.attachments.map(attachment => ({
            id: attachment.id || createEntityId('attachment'),
            receiptLineId: attachment.receiptLineId || '',
            fileName: attachment.fileName || 'warehouse-photo.jpg',
            mimeType: attachment.mimeType || 'image/jpeg',
            size: Number.parseInt(attachment.size || 0, 10) || 0,
            createdAt: toIsoDateTime(attachment.createdAt),
            ...(attachment.legacyDataUrl ? { legacyDataUrl: attachment.legacyDataUrl } : {})
        })) : []
    };
}

function migrateLegacyDomainData(legacyItems, legacyPrs, legacyStock) {
    const now = new Date().toISOString();
    const categories = getDefaultCategories();
    const itemIdByLegacyId = new Map();
    const itemIdByName = new Map();
    const items = legacyItems.map(item => {
        const id = createEntityId('item');
        itemIdByLegacyId.set(item.id, id);
        itemIdByName.set(String(item.name || '').toLowerCase(), id);
        const category = categories.find(entry => entry.name.toLowerCase() === String(item.category || '').toLowerCase());
        return {
            id,
            sku: item.sku || '',
            name: item.name || 'Untitled item',
            categoryId: category?.id || 'general',
            unit: item.unit || 'pcs',
            itemType: item.itemType === 'Set' ? 'Set' : 'Single',
            partsPerSet: Math.max(1, Number.parseInt(item.partsPerSet || 1, 10) || 1),
            isActive: true,
            createdAt: now,
            updatedAt: now
        };
    });

    const getMappedItem = source => {
        return itemIdByLegacyId.get(source.itemId) || itemIdByName.get(String(source.itemName || source.item || '').toLowerCase()) || '';
    };
    const itemById = new Map(items.map(item => [item.id, item]));
    const prIdByNumber = new Map();
    const purchaseRequests = legacyPrs.map(pr => {
        const id = createEntityId('pr');
        const number = pr.number || pr.id || pr.pr || 'PR-Unnumbered';
        prIdByNumber.set(number.toLowerCase(), id);
        return {
            id,
            number,
            workflowStatus: String(pr.status || 'open').toLowerCase(),
            createdAt: toIsoDateTime(pr.createdAt),
            updatedAt: toIsoDateTime(pr.createdAt),
            lines: (pr.items || []).map(line => {
                const itemId = getMappedItem(line);
                const item = itemById.get(itemId);
                return {
                    id: createEntityId('pr-line'),
                    itemId,
                    orderedQty: Math.max(0, Number.parseInt(line.qty || 0, 10) || 0),
                    unit: item?.itemType === 'Set' ? 'set' : item?.unit || 'pcs',
                    itemSnapshot: {
                        sku: item?.sku || '',
                        name: item?.name || line.itemName || 'Untitled item',
                        unit: item?.unit || 'pcs',
                        itemType: item?.itemType || line.itemType || 'Single',
                        partsPerSet: item?.partsPerSet || Math.max(1, Number.parseInt(line.partsPerSet || 1, 10) || 1)
                    }
                };
            })
        };
    });

    const prLineByItem = new Map();
    purchaseRequests.forEach(pr => pr.lines.forEach(line => {
        prLineByItem.set(`${pr.id}|${line.itemId}`, line.id);
    }));
    const receiptGroups = new Map();
    const assignments = [];
    const attachments = [];

    legacyStock.forEach(stock => {
        const prNumber = stock.pr || '';
        const purchaseRequestId = prIdByNumber.get(prNumber.toLowerCase()) || '';
        const groupKey = `${stock.id || ''}|${prNumber}|${stock.createdAt || ''}`;
        if (!receiptGroups.has(groupKey)) {
            receiptGroups.set(groupKey, {
                id: createEntityId('receipt'),
                number: stock.id || 'FNG-Unnumbered',
                purchaseRequestId,
                workflowStatus: 'posted',
                receivedAt: toIsoDateTime(stock.createdAt),
                lines: []
            });
        }
        const receipt = receiptGroups.get(groupKey);
        const itemId = getMappedItem(stock);
        const item = itemById.get(itemId);
        const partsPerSet = item?.partsPerSet || Math.max(1, Number.parseInt(stock.partsPerSet || 1, 10) || 1);
        const partNumber = Number.parseInt(String(stock.partLabel || '').split('/')[0], 10) || 0;
        const lineId = createEntityId('receipt-line');
        receipt.lines.push({
            id: lineId,
            prLineId: prLineByItem.get(`${purchaseRequestId}|${itemId}`) || '',
            itemId,
            itemSnapshot: {
                sku: item?.sku || '',
                name: item?.name || stock.item || 'Untitled item',
                unit: item?.unit || 'pcs',
                partsPerSet
            },
            partNumber,
            receivedQty: Math.max(0, Number.parseInt(stock.qty || 0, 10) || 0),
            quantityUnit: partsPerSet > 1 ? 'part' : item?.unit || 'pcs'
        });
        (stock.locations || []).forEach(location => assignments.push({
            id: createEntityId('assignment'),
            receiptLineId: lineId,
            palletCode: location.pallet || '',
            zoneId: location.zone || 'A',
            qty: Math.max(0, Number.parseInt(location.qty || 0, 10) || 0),
            quantityUnit: partsPerSet > 1 ? 'part' : item?.unit || 'pcs',
            assignedAt: toIsoDateTime(location.createdAt || stock.createdAt)
        }));
        (stock.attachedPhotos || []).forEach((photo, index) => {
            const isObject = photo && typeof photo === 'object';
            attachments.push({
                id: isObject && photo.id ? photo.id : createEntityId('attachment'),
                receiptLineId: lineId,
                fileName: isObject && photo.fileName ? photo.fileName : `warehouse-photo-${index + 1}.jpg`,
                mimeType: isObject && photo.mimeType ? photo.mimeType : 'image/jpeg',
                size: isObject && photo.size ? photo.size : 0,
                createdAt: toIsoDateTime(isObject && photo.createdAt ? photo.createdAt : stock.createdAt),
                ...(!isObject && typeof photo === 'string' ? { legacyDataUrl: photo } : {})
            });
        });
    });

    return normalizeDomainData({
        schemaVersion: APP_SCHEMA_VERSION,
        updatedAt: now,
        categories,
        units: ['pcs', 'set', 'box', 'm', 'kg'],
        zones: getDefaultZones(),
        items,
        purchaseRequests,
        receipts: Array.from(receiptGroups.values()),
        assignments,
        attachments
    });
}

function loadOrMigrateDomainData(legacyStock, legacyItems, legacyPrs) {
    try {
        const stored = localStorage.getItem(APP_DATA_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.schemaVersion === APP_SCHEMA_VERSION) return normalizeDomainData(parsed);
        }
    } catch (error) {
        console.warn('Unable to load v2 warehouse data:', error);
    }

    const migrated = migrateLegacyDomainData(legacyItems, legacyPrs, legacyStock);
    try {
        localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
        console.warn('Unable to save migrated warehouse data:', error);
    }
    return migrated;
}

function hydrateMasterItems(data) {
    const categoryById = new Map(data.categories.map(category => [category.id, category.name]));
    return data.items.map(item => ({
        ...item,
        category: categoryById.get(item.categoryId) || 'General'
    }));
}

function hydratePurchaseRequests(data) {
    return data.purchaseRequests.map(pr => ({
        id: pr.id,
        number: pr.number,
        createdAt: formatDomainDateTime(pr.createdAt),
        status: pr.workflowStatus,
        items: pr.lines.map(line => ({
            lineId: line.id,
            itemId: line.itemId,
            itemName: line.itemSnapshot.name,
            qty: line.orderedQty,
            unit: line.unit,
            itemType: line.itemSnapshot.itemType,
            partsPerSet: line.itemSnapshot.partsPerSet
        }))
    }));
}

function hydrateInventory(data, items, prs) {
    const itemById = new Map(items.map(item => [item.id, item]));
    const prById = new Map(prs.map(pr => [pr.id, pr]));
    const assignmentsByLine = new Map();
    data.assignments.forEach(assignment => {
        if (!assignmentsByLine.has(assignment.receiptLineId)) assignmentsByLine.set(assignment.receiptLineId, []);
        assignmentsByLine.get(assignment.receiptLineId).push(assignment);
    });
    const attachmentsByLine = new Map();
    data.attachments.forEach(attachment => {
        if (!attachmentsByLine.has(attachment.receiptLineId)) attachmentsByLine.set(attachment.receiptLineId, []);
        attachmentsByLine.get(attachment.receiptLineId).push(attachment);
    });

    return data.receipts.flatMap(receipt => receipt.lines.map(line => {
        const item = itemById.get(line.itemId);
        const partsPerSet = line.itemSnapshot.partsPerSet || item?.partsPerSet || 1;
        return {
            receiptId: receipt.id,
            lineId: line.id,
            id: receipt.number,
            prId: receipt.purchaseRequestId,
            pr: prById.get(receipt.purchaseRequestId)?.number || '',
            createdAt: formatDomainDateTime(receipt.receivedAt),
            itemId: line.itemId,
            item: line.itemSnapshot.name || item?.name || 'Untitled item',
            partLabel: line.partNumber && partsPerSet > 1 ? `${line.partNumber}/${partsPerSet}` : '',
            partsPerSet,
            qty: line.receivedQty,
            quantityUnit: line.quantityUnit,
            isExpanded: false,
            locations: (assignmentsByLine.get(line.id) || []).map(assignment => ({
                id: assignment.id,
                pallet: assignment.palletCode,
                zone: assignment.zoneId,
                qty: assignment.qty,
                quantityUnit: assignment.quantityUnit,
                createdAt: formatDomainDateTime(assignment.assignedAt)
            })),
            attachedPhotos: (attachmentsByLine.get(line.id) || []).map(attachment => ({
                id: attachment.id,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                size: attachment.size,
                createdAt: formatDomainDateTime(attachment.createdAt),
                url: attachment.legacyDataUrl || '',
                stored: !attachment.legacyDataUrl
            })),
            tempPallet: '',
            tempZone: 'A',
            tempQty: ''
        };
    }));
}

function findOrCreateCategoryId(name, categories) {
    const normalized = String(name || 'General').trim();
    const existing = categories.find(category => category.name.toLowerCase() === normalized.toLowerCase());
    if (existing) return existing.id;
    const id = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || createEntityId('category');
    categories.push({ id, name: normalized, isActive: true });
    return id;
}

function buildDomainDataFromState() {
    const categories = (appData.categories || getDefaultCategories()).map(category => ({ ...category }));
    const now = new Date().toISOString();
    const items = masterItems.map(item => ({
        id: item.id || createEntityId('item'),
        sku: item.sku,
        name: item.name,
        categoryId: findOrCreateCategoryId(item.category, categories),
        unit: item.unit,
        itemType: item.itemType,
        partsPerSet: item.partsPerSet,
        isActive: item.isActive !== false,
        createdAt: toIsoDateTime(item.createdAt || now),
        updatedAt: toIsoDateTime(item.updatedAt || now)
    }));
    const itemById = new Map(items.map(item => [item.id, item]));
    const purchaseRequestData = purchaseRequests.map(pr => ({
        id: pr.id || createEntityId('pr'),
        number: pr.number,
        workflowStatus: pr.status || 'open',
        createdAt: toIsoDateTime(pr.createdAt),
        updatedAt: now,
        lines: pr.items.map(line => {
            const item = itemById.get(line.itemId);
            return {
                id: line.lineId || createEntityId('pr-line'),
                itemId: line.itemId,
                orderedQty: Math.max(0, Number.parseInt(line.qty || 0, 10) || 0),
                unit: line.unit || (item?.itemType === 'Set' ? 'set' : item?.unit || 'pcs'),
                itemSnapshot: {
                    sku: item?.sku || '',
                    name: line.itemName || item?.name || 'Untitled item',
                    unit: item?.unit || line.unit || 'pcs',
                    itemType: line.itemType || item?.itemType || 'Single',
                    partsPerSet: line.partsPerSet || item?.partsPerSet || 1
                }
            };
        })
    }));

    const receiptGroups = new Map();
    const assignments = [];
    const attachments = [];
    inventory.forEach(row => {
        row.receiptId = row.receiptId || createEntityId('receipt');
        row.lineId = row.lineId || createEntityId('receipt-line');
        if (!receiptGroups.has(row.receiptId)) {
            receiptGroups.set(row.receiptId, {
                id: row.receiptId,
                number: row.id,
                purchaseRequestId: row.prId || '',
                workflowStatus: 'posted',
                receivedAt: toIsoDateTime(row.createdAt),
                lines: []
            });
        }
        const receipt = receiptGroups.get(row.receiptId);
        const item = itemById.get(row.itemId);
        const partNumber = Number.parseInt(String(row.partLabel || '').split('/')[0], 10) || 0;
        receipt.lines.push({
            id: row.lineId,
            prLineId: row.prLineId || purchaseRequests.find(pr => pr.id === row.prId)?.items.find(line => line.itemId === row.itemId)?.lineId || '',
            itemId: row.itemId,
            itemSnapshot: {
                sku: item?.sku || '',
                name: row.item || item?.name || 'Untitled item',
                unit: item?.unit || 'pcs',
                partsPerSet: row.partsPerSet || item?.partsPerSet || 1
            },
            partNumber,
            receivedQty: Math.max(0, Number.parseInt(row.qty || 0, 10) || 0),
            quantityUnit: row.quantityUnit || ((row.partsPerSet || 1) > 1 ? 'part' : item?.unit || 'pcs')
        });
        row.locations.forEach(location => {
            location.id = location.id || createEntityId('assignment');
            assignments.push({
                id: location.id,
                receiptLineId: row.lineId,
                palletCode: location.pallet,
                zoneId: location.zone,
                qty: Math.max(0, Number.parseInt(location.qty || 0, 10) || 0),
                quantityUnit: location.quantityUnit || row.quantityUnit || 'pcs',
                assignedAt: toIsoDateTime(location.createdAt)
            });
        });
        row.attachedPhotos.forEach(photo => {
            if (!photo || typeof photo !== 'object') return;
            attachments.push({
                id: photo.id || createEntityId('attachment'),
                receiptLineId: row.lineId,
                fileName: photo.fileName || 'warehouse-photo.jpg',
                mimeType: photo.mimeType || 'image/jpeg',
                size: Number.parseInt(photo.size || 0, 10) || 0,
                createdAt: toIsoDateTime(photo.createdAt),
                ...(!photo.stored && String(photo.url || '').startsWith('data:') ? { legacyDataUrl: photo.url } : {})
            });
        });
    });

    return normalizeDomainData({
        schemaVersion: APP_SCHEMA_VERSION,
        updatedAt: now,
        categories,
        units: appData.units,
        zones: appData.zones,
        items,
        purchaseRequests: purchaseRequestData,
        receipts: Array.from(receiptGroups.values()),
        assignments,
        attachments
    });
}

function saveDomainState() {
    try {
        appData = buildDomainDataFromState();
        localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(appData));
        return true;
    } catch (error) {
        console.warn('Unable to save warehouse data:', error);
        return false;
    }
}

function openPhotoDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB is unavailable.'));
            return;
        }
        const request = indexedDB.open(PHOTO_DB_NAME, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(PHOTO_STORE_NAME)) {
                database.createObjectStore(PHOTO_STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Unable to open photo storage.'));
    });
}

async function writePhotoBlob(photoId, blob) {
    const database = await openPhotoDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PHOTO_STORE_NAME, 'readwrite');
        transaction.objectStore(PHOTO_STORE_NAME).put(blob, photoId);
        transaction.oncomplete = () => {
            database.close();
            resolve(true);
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error('Unable to save photo.'));
        };
    });
}

async function readPhotoBlob(photoId) {
    const database = await openPhotoDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PHOTO_STORE_NAME, 'readonly');
        const request = transaction.objectStore(PHOTO_STORE_NAME).get(photoId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Unable to read photo.'));
        transaction.oncomplete = () => database.close();
    });
}

async function deletePhotoBlob(photoId) {
    const database = await openPhotoDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PHOTO_STORE_NAME, 'readwrite');
        transaction.objectStore(PHOTO_STORE_NAME).delete(photoId);
        transaction.oncomplete = () => {
            database.close();
            resolve(true);
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error('Unable to delete photo.'));
        };
    });
}

async function initializeAttachmentStorage() {
    let shouldPersistMetadata = false;
    let shouldRender = false;
    for (const item of inventory) {
        for (const photo of item.attachedPhotos) {
            if (!photo || typeof photo !== 'object') continue;
            try {
                if (photo.url && photo.url.startsWith('data:') && !photo.stored) {
                    const blob = await fetch(photo.url).then(response => response.blob());
                    await writePhotoBlob(photo.id, blob);
                    photo.stored = true;
                    shouldPersistMetadata = true;
                } else if (!photo.url && photo.stored) {
                    const blob = await readPhotoBlob(photo.id);
                    if (blob) {
                        photo.url = URL.createObjectURL(blob);
                        shouldRender = true;
                    }
                }
            } catch (error) {
                console.warn(`Unable to initialize attachment ${photo.id}:`, error);
            }
        }
    }
    if (shouldPersistMetadata) saveDomainState();
    if (shouldRender) renderInventory();
}

function revokeAttachmentUrl(photo) {
    if (photo && typeof photo === 'object' && String(photo.url || '').startsWith('blob:')) {
        URL.revokeObjectURL(photo.url);
    }
}

function escapeHtml(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getItemStatus(item) {
    const remainingQty = item.qty - totalAbbr(item);
    if (remainingQty === 0) return 'Complete';
    if (remainingQty < 0) return 'Over-assigned';
    return 'Open';
}

function getStatusClass(status) {
    if (status === 'Complete') return 'status-complete';
    if (status === 'Over-assigned' || status === 'Over-received') return 'status-over';
    return 'status-open';
}

function getInventoryTotals(items = inventory) {
    const totalQty = items.reduce((sum, item) => sum + Number.parseInt(item.qty || 0, 10), 0);
    const assignedQty = items.reduce((sum, item) => sum + totalAbbr(item), 0);
    const remainingQty = totalQty - assignedQty;
    const uniqueItems = new Set(items.map(item => item.item.toLowerCase().trim()).filter(Boolean)).size;
    const uniquePrs = new Set(items.map(item => item.pr).filter(Boolean)).size;
    const openItems = items.filter(item => getItemStatus(item) === 'Open').length;
    const completeItems = items.filter(item => getItemStatus(item) === 'Complete').length;
    const overItems = items.filter(item => getItemStatus(item) === 'Over-assigned').length;

    return { totalQty, assignedQty, remainingQty, uniqueItems, uniquePrs, openItems, completeItems, overItems };
}

function getZoneSummary() {
    const summary = validZones.reduce((acc, zone) => {
        acc[zone] = 0;
        return acc;
    }, {});

    inventory.forEach(item => {
        item.locations.forEach(loc => {
            const zone = loc.zone || 'Unassigned';
            summary[zone] = (summary[zone] || 0) + (Number.parseInt(loc.qty || 0, 10) || 0);
        });
    });

    return Object.entries(summary).map(([zone, qty]) => ({ zone, qty }));
}

function getItemRows() {
    return masterItems.map(masterItem => {
        const prLines = [];
        purchaseRequests.forEach(pr => {
            pr.items
                .filter(line => line.itemId === masterItem.id || line.itemName.toLowerCase() === masterItem.name.toLowerCase())
                .forEach(line => prLines.push({ pr, line }));
        });
        const requested = prLines.reduce((sum, row) => sum + (Number.parseInt(row.line.qty || 0, 10) || 0), 0);
        const received = prLines.reduce((sum, row) => sum + getReceivedSetsForPrLine(row.pr.id, row.line), 0);
        const itemEntries = inventory.filter(item => item.itemId === masterItem.id || item.item.toLowerCase() === masterItem.name.toLowerCase());
        const assigned = prLines.reduce((sum, row) => sum + getAssignedSetsForPrLine(row.pr.id, row.line), 0);
        const remaining = requested - received;
        const prs = new Set(prLines.map(row => row.pr.number));
        const fngs = new Set(itemEntries.map(item => item.id).filter(Boolean));
        const status = remaining === 0 && requested > 0 ? 'Complete' : remaining < 0 ? 'Over-received' : 'Open';

        return {
            item: masterItem.name,
            sku: masterItem.sku,
            itemType: masterItem.itemType,
            partsPerSet: masterItem.partsPerSet,
            requested,
            received,
            assigned,
            remaining,
            prs: Array.from(prs).join(', '),
            fngs: Array.from(fngs).join(', '),
            status
        };
    });
}

function getPrRows() {
    return purchaseRequests.map(pr => {
        const requested = pr.items.reduce((sum, line) => sum + (Number.parseInt(line.qty || 0, 10) || 0), 0);
        const received = pr.items.reduce((sum, line) => sum + getReceivedSetsForPrLine(pr.id, line), 0);
        const assigned = pr.items.reduce((sum, line) => sum + getAssignedSetsForPrLine(pr.id, line), 0);
        const remaining = requested - received;
        const status = remaining === 0 ? 'Complete' : remaining < 0 ? 'Over-received' : 'Open';
        return {
            id: pr.id,
            pr: pr.number,
            lines: pr.items,
            items: pr.items.length,
            requested,
            received,
            assigned,
            remaining,
            createdAt: pr.createdAt,
            status
        };
    });
}

function statusPill(status) {
    return `<span class="status-pill ${getStatusClass(status)}">${escapeHtml(status)}</span>`;
}
