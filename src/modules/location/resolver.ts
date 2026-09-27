export type ResolvedLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

export interface LocationResolver {
  resolve(description: string): Promise<ResolvedLocation | null>;
}

const knownPlaces: Array<{ aliases: string[]; location: ResolvedLocation }> = [
  {
    aliases: ["manhattan", "new york city", "nyc"],
    location: {
      name: "Manhattan, New York City",
      latitude: 40.7831,
      longitude: -73.9712,
    },
  },
  {
    aliases: ["brooklyn"],
    location: {
      name: "Brooklyn, New York City",
      latitude: 40.6782,
      longitude: -73.9442,
    },
  },
  {
    aliases: ["los angeles", "la"],
    location: {
      name: "Los Angeles, California",
      latitude: 34.0522,
      longitude: -118.2437,
    },
  },
  {
    aliases: ["san francisco", "sf"],
    location: {
      name: "San Francisco, California",
      latitude: 37.7749,
      longitude: -122.4194,
    },
  },
  {
    aliases: ["houston"],
    location: {
      name: "Houston, Texas",
      latitude: 29.7604,
      longitude: -95.3698,
    },
  },
  {
    aliases: ["miami"],
    location: {
      name: "Miami, Florida",
      latitude: 25.7617,
      longitude: -80.1918,
    },
  },
  {
    aliases: ["chicago"],
    location: {
      name: "Chicago, Illinois",
      latitude: 41.8781,
      longitude: -87.6298,
    },
  },
];

export class DeterministicLocationResolver implements LocationResolver {
  async resolve(description: string): Promise<ResolvedLocation | null> {
    const normalized = description.toLocaleLowerCase("en-US");
    const match = knownPlaces
      .flatMap((place) =>
        place.aliases.map((alias) => ({ alias, location: place.location })),
      )
      .sort((a, b) => b.alias.length - a.alias.length)
      .find(({ alias }) =>
        new RegExp(
          `(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`,
          "i",
        ).test(normalized),
      );
    return match?.location ?? null;
  }
}
