import { faker } from '@faker-js/faker'
import { getModel } from "./utils/mongo";
import { Collection } from './utils/types';

async function seedCollections(count: number): Promise<Collection[]> {
  const CollectionModel = await getModel('Collection');
  const collections: Collection[] = [];

  for (let i = 0; i < count; i++) {
    const collection: Collection = new CollectionModel({
      address: faker.random.alphaNumeric(42),
      owner: faker.random.alphaNumeric(42),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      symbol: faker.finance.currencyCode(),
      total_supply: faker.datatype.number({ min: 1, max: 10000 }),
      verified: faker.datatype.boolean(),
      visible: faker.datatype.boolean(),
      created_at: faker.date.past(),
      updated_at: faker.date.recent(),
    });

    await collection.save();
    collections.push(collection);
  }

  return collections;
}

async function seedMetadata(count: number, parentCollections: Collection[]): Promise<void> {
  const MetadataModel = await getModel('Metadata');

  for (let i = 0; i < count; i++) {
    const metadata = new MetadataModel({
      parent_collection: parentCollections[i % parentCollections.length]._id,
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      mp4: faker.datatype.boolean(),
      webm: faker.datatype.boolean(),
      gif: faker.datatype.boolean(),
      created_at: faker.date.past(),
      updated_at: faker.date.recent(),
    });

    await metadata.save();
  }
}

async function seedTokens(count: number, parentCollections: Collection[]): Promise<void> {
  const TokenModel = await getModel('Token');

  for (let i = 0; i < count; i++) {
    const token = new TokenModel({
      parent_collection: parentCollections[i % parentCollections.length]._id,
      token_id: faker.datatype.uuid(),
      metadata: null,
      attributes: [],
      burned: faker.datatype.boolean(),
      created_at: faker.date.past(),
      updated_at: faker.date.recent(),
    });

    await token.save();
  }
}

(async () => {
  try {
    const collectionCount = 5;
    const metadataCount = 10;
    const tokenCount = 20;

    const collections = await seedCollections(collectionCount);
    await seedMetadata(metadataCount, collections);
    await seedTokens(tokenCount, collections);

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
})();