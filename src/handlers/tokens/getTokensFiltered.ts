/* This file defines an API endpoint that takes an NFT collection's contract address, 
 filter parameters, and optional pagination parameters (page and size) as input. 
 The main goal of this endpoint is to retrieve and return information about the tokens
  within the specified collection, based on the provided filter parameters. 

  The main handler function checks if the provided address is valid, retrieves the NFT collection with the specified contract address,
  and constructs a filter query based on the provided query string parameters.
  It then fetches the attributes and tokens that match the filter query, applying pagination as needed.

  To make a request to this API endpoint, you'll need to know the base URL where your API is hosted,
  the contract address of the NFT collection, and the filter parameters you want to apply.
  The request format would look like this: {BASE_URL}/dev/tokens/filtered/{contract_address}?Artist=John%20Smith
  
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getAddress, isAddress } from "ethers/lib/utils";
import { paramCase } from "param-case";
import { CONTENT_DELIVERY_NETWORK_URI, NETWORK } from "../../../utils";
import { getModel } from "../../../utils/mongo";
import { Attribute, Collection, Token } from "../../../utils/types";
import forEach from "lodash/forEach";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const address = event.pathParameters?.address as string;

  if (event.httpMethod?.toUpperCase() === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "",
    };
  }

  if (address && isAddress(address)) {
    try {
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

      const filterQuery: { trait_type: string; value: string }[] = [];
      forEach(event.queryStringParameters, (value, key) => {
        if (["address", "page", "size"].includes(key)) return;

        const search = {
          trait_type: key,
          value: value as string,
        };

        filterQuery.push(search);
      });

      if (filterQuery.length === 0) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: { message: "Missing parameter(s)." } }),
        };
      }

      const attributeModel = await getModel("Attribute");
      const attributes: Attribute[] = await attributeModel
        .find({
          parent_collection: collection,
          $or: filterQuery,
        })
        .exec();

      const tokenModel = await getModel("Token");
      const tokens = await tokenModel.paginate(
        { parent_collection: collection, attributes: { $all: attributes.map((obj) => obj._id) } },
        {
          page: event.queryStringParameters?.page ? parseInt(event.queryStringParameters?.page as string, 10) : 1,
          limit: event.queryStringParameters?.size ? parseInt(event.queryStringParameters?.size as string, 10) : 1000,
          sort: { token_id: "asc" },
          populate: ["metadata", "attributes"],
          collation: { locale: "en_US", numericOrdering: true },
        }
      );

      let data = {};
      tokens.docs.forEach((token: Token) => {
        const metaName = paramCase(token.metadata.name);
        data = {
          ...data,
          [token.token_id]: {
            tokenId: token.token_id,
            name: token.metadata.name,
            description: token.metadata.description,
            image: {
              original: `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${metaName}.png`,
              thumbnail: `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(
                collection.address
              )}/${metaName}-1000.png`,
              mp4: token.metadata.mp4
                ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${metaName}.mp4`
                : null,
              webm: token.metadata.webm
                ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${metaName}.webm`
                : null,
              gif: token.metadata.gif
                ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${metaName}.gif`
                : null,
            },
            attributes: token.attributes
              ? token.attributes.map((attribute: Attribute) => ({
                  traitType: attribute.trait_type,
                  value: attribute.value,
                  displayType: attribute.display_type,
                }))
              : [],
            collection: {
              name: collection.name,
            },
          },
        };
      });

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ total: tokens.totalDocs, data }),
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
