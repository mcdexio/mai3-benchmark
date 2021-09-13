

export interface NamedTransation {
    name: string
    transaction: Promise<any>
}

export async function spawn(transations: NamedTransation[], beginAt = 0) {
    let results = {}
    for (let i = 0; i < transations.length; i++) {
        const { name, transaction } = transations[i];
        if (i < beginAt) {
            results[name] = null
            continue
        }
        try {
            const result = await transaction
            results[name] = result
        } catch (err) {
            console.log(`error ocurred on executing ${name}: ${err}`)
            return results
        }
    }
    return results
}
