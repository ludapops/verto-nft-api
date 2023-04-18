import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getAddress, isAddress } from "ethers/lib/utils";
import { getCDN } from "../../utils";
import { getModel } from "../../utils/mongo";
import { Attribute, Collection } from "../../utils/types";

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

  const address = event.queryStringParameters?.address;

  if (address && isAddress(address)) {
    try {
      const collectionModel = await getModel("Collection");
      const collection: Collection = await collectionModel
        .findOne({
          address: address.toLowerCase(),
          visible: true,
        })
        .exec();

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

      const attributeModel = await getModel("Attribute");
      const attributes: Attribute[] = await attributeModel
        .find({ parent_collection: collection })
        .sort({ trait_type: "asc", value: "asc" })
        .exec();

      const data = {
        address: getAddress(collection.address),
        owner: getAddress(collection.owner),
        name: collection.name,
        description: collection?.description,
        symbol: collection.symbol,
        totalSupply: collection.total_supply,
        verified: collection.verified,
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
        avatar: getCDN(collection.address, "avatar"),
        banner: {
          large: getCDN(collection.address, "banner-lg"),
          small: getCDN(collection.address, "banner-sm"),
        },
        attributes: attributes
          ? attributes.map((attribute: Attribute) => ({
              traitType: attribute.trait_type,
              value: attribute.value,
              displayType: attribute.display_type,
            }))
          : [],
      };

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ data }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: { message: "Unknown error." } }),
      };
    }
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
