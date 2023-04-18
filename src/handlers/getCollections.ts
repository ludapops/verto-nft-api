import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getAddress } from "ethers/lib/utils";
import { getCDN } from "../../utils";
import { getModel } from "../../utils/mongo";
import { Collection } from "../../utils/types";

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

  try {
    const collectionModel = await getModel("Collection");
    const collections: Collection[] = await collectionModel.find({ visible: true }).sort({ updated_at: "desc" }).exec();

    const data = collections.map((collection: Collection) => ({
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
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ total: data.length, data }),
    };
  } catch (error) {
    console.log({ error });
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: { message: "Unknown error." } }),
    };
  }
};
