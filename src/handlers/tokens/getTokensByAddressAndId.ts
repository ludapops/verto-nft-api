/*
    This code is an API endpoint that fetches NFT token details by the token's contract address and token ID. 
    It checks whether the NFT token exists in the database; if not,
    it fetches the token details from the blockchain using the contract address and token ID,
    then returns the token data as a JSON response.
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Contract } from "@ethersproject/contracts";
import { getAddress, isAddress } from "ethers/lib/utils";
import { Attribute, Collection, Token } from "../../../utils/types";
import { getModel } from "../../../utils/mongo";
import { CONTENT_DELIVERY_NETWORK_URI, getTokenURI, NETWORK } from "../../../utils";
import { paramCase } from "param-case";
import axios from "axios";
import provider from "../../../utils/provider";
import ercABI from "../../../utils/abis/ERC721.json";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod?.toUpperCase() === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "",
    };
  }

  const { address, id } = event.queryStringParameters;

  if (address && isAddress(address) && id) {
    try {
      const collectionModel = await getModel("Collection");
      const collection: Collection = await collectionModel.findOne({ address: address.toLowerCase() }).exec();
      if (!collection) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: { message: "Entity not found." } }),
        };
      }

      const tokenModel = await getModel("Token");
      const token: Token = await tokenModel
        .findOne({ parent_collection: collection, token_id: id.toLowerCase() })
        .populate(["parent_collection", "metadata", "attributes"])
        .exec();

      if (!token) {
        const contract = new Contract(collection.address, ercABI, provider);
        const tokenURI = await contract.tokenURI(id);

        const response = await axios(getTokenURI(tokenURI));

        const data = {
          tokenId: id,
          name: response.data.name,
          description: response.data.description,
          image: {
            original: `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
              response.data.name
            )}.png`,
            thumbnail: `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
              response.data.name
            )}-1000.png`,
            mp4: response.data.mp4_url
              ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
                  response.data.name
                )}.mp4`
              : null,
            webm: response.data.webm_url
              ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
                  response.data.name
                )}.webm`
              : null,
            gif: response.data.gif_url
              ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
                  response.data.name
                )}.gif`
              : null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attributes: response.data.attributes
            ? Object.keys(response.data.attributes).map((attribute: any) => ({
                traitType: attribute,
                value: response.data.attributes[attribute],
                displayType: null,
              }))
            : [],
          collection: {
            name: "Pancake Bunnies",
          },
        };

        return {
          statusCode: 200,
          body: JSON.stringify({ data }),
        };
      } else {
        const data = {
          tokenId: id,
          name: token.metadata.name,
          description: token.metadata.description,
          image: {
            original: `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
              token.metadata.name
            )}.png`,
            thumbnail: `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
              token.metadata.name
            )}-1000.png`,
            mp4: token.metadata.mp4
              ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
                  token.metadata.name
                )}.mp4`
              : null,
            webm: token.metadata.webm
              ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
                  token.metadata.name
                )}.webm`
              : null,
            gif: token.metadata.gif
              ? `${CONTENT_DELIVERY_NETWORK_URI}/${NETWORK}/${getAddress(collection.address)}/${paramCase(
                  token.metadata.name
                )}.gif`
              : null,
          },
          createdAt: token.created_at,
          updatedAt: token.updated_at,
          attributes: token.attributes
            ? token.attributes.map((attribute: Attribute) => ({
                traitType: attribute.trait_type,
                value: attribute.value,
                displayType: attribute.display_type,
              }))
            : [],
          collection: {
            name: token.parent_collection.name,
          },
        };

        return {
          statusCode: 200,
          body: JSON.stringify({ data }),
        };
      }
    } catch (error) {
      console.log({ error });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: { message: "Unknown error." } }),
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ error: { message: "Invalid address." } }),
  };
};
