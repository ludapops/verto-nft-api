/*
This endpoint checks if the requested collection's contract address matches the Pancake Bunnies address.
If it does, it uses the fetchPancakeBunnies function; otherwise, it uses fetchGeneric.
The handler returns the calculated attribute distribution data as a JSON response.

To make a request to this API endpoint, you'll need to know the base URL where your API is hosted
and the contract address of the NFT collection. The request format would look like this: 
GET {BASE_URL}/tokens/distribution/{contract_address}
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { isAddress } from "ethers/lib/utils";
import get from "lodash/get";
import { Attribute, Token, Collection } from "../../utils/types";
import { getModel } from "../../utils/mongo";

const PANCAKE_BUNNY_ADDRESS = process.env.PANCAKE_BUNNY_ADDRESS as string;

/**
 * Fetch tokens from a generic collection
 * @param collection
 * @returns
 */
const fetchGeneric = async (collection: Collection) => {
  const tokenModel = await getModel("Token");
  const tokens: Token[] = await tokenModel.find({ parent_collection: collection }).populate(["attributes"]).exec();

  const attributesDistribution: { [key: string]: { [key: string]: number } } = {};
  tokens.forEach((token: Token) => {
    // update the attributesDistribution distribution according to this token attributes
    token.attributes.forEach((attribute) => {
      const traitType = attribute.trait_type;
      const traitValue = attribute.value;
      // Safe checks on the object structure
      if (!get(attributesDistribution, traitType)) {
        attributesDistribution[traitType] = {};
      }
      if (!get(attributesDistribution, [traitType, traitValue])) {
        attributesDistribution[traitType][traitValue] = 0;
      }

      attributesDistribution[traitType][traitValue] += 1;
    });
  });

  return { attributesDistribution };
};

/**
 * Fetch tokens from the pancake bunnies collection
 * @param collection
 * @returns
 */
const fetchPancakeBunnies = async (collection: Collection) => {
  const attributeModel = await getModel("Attribute");
  const attributes: Attribute[] = await attributeModel
    .find({ parent_collection: collection })
    .sort({ value: "asc" })
    .collation({ locale: "en_US", numericOrdering: true })
    .exec();

  const tokenModel = await getModel("Token");
  const promisesAttributesDistribution = attributes.map(async (attribute: Attribute) => {
    return await tokenModel
      .aggregate([
        {
          $match: {
            parent_collection: collection._id,
            attributes: attribute._id,
            burned: false,
          },
        },
      ])
      .count("token_id")
      .exec();
  });
  const attributesDistribution = await Promise.all(promisesAttributesDistribution);

  return {
    attributesDistribution: attributesDistribution.reduce(
      (acc, value, index) => ({ ...acc, [index]: value[0] ? value[0].token_id : 0 }),
      {}
    ),
  };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod?.toUpperCase() === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: "",
    };
  }

  const address = event.pathParameters?.address;

  if (address && isAddress(address)) {
    const collectionModel = await getModel("Collection");
    const collection: Collection = await collectionModel.findOne({ address: address.toLowerCase() }).exec();
    if (!collection) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: { message: "Entity not found." } }),
      };
    }

    const { attributesDistribution } =
      address.toLowerCase() === PANCAKE_BUNNY_ADDRESS?.toLowerCase()
        ? await fetchPancakeBunnies(collection)
        : await fetchGeneric(collection);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ total: Object.keys(attributesDistribution).length, data: attributesDistribution }),
    };
  }

  return {
    statusCode: 400,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ error: { message: "Invalid address." } }),
  };
};
