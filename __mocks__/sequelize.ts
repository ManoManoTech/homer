const { DataTypes, Model, Op } = jest.requireActual('sequelize');

type EntryValues = Record<string, unknown>;

interface Options {
  where: EntryValues;
}

class EntryMock {
  constructor(public values: EntryValues) {}

  toJSON() {
    return this.values;
  }

  async update(newValues: EntryValues): Promise<EntryMock> {
    this.values = { ...this.values, ...newValues };
    return this;
  }
}

class ModelMock {
  readonly entries: EntryMock[] = [];

  async create(values: EntryValues): Promise<void> {
    this.entries.push(new EntryMock(values));
  }

  async destroy({ where }: Options): Promise<void> {
    const entry = await this.findOne({ where });

    if (entry !== null) {
      this.entries.splice(this.entries.indexOf(entry), 1);
    }
  }

  async drop(): Promise<void> {}

  async findAll(): Promise<EntryMock[]> {
    return this.entries;
  }

  async findOne({ where }: Options): Promise<EntryMock | null> {
    return (
      this.entries.find(
        (entry) =>
          !where ||
          Object.entries(where).every(
            ([key, value]) => entry.values[key] === value
          )
      ) || null
    );
  }

  async findOrCreate({ where }: Options): Promise<void> {
    if ((await this.findOne({ where })) === null) {
      this.entries.push(new EntryMock(where));
    }
  }

  async sync() {}
}

class SequelizeMock {
  static models: { [name: string]: ModelMock } = {};

  define(name: string): ModelMock {
    const modelMock = new ModelMock();
    SequelizeMock.models[name] = modelMock;
    return modelMock;
  }

  getQueryInterface = () => ({
    changeColumn: () => Promise.resolve(),
  });

  sync() {}

  async transaction(callback: (transaction: any) => Promise<any>) {
    return callback({
      LOCK: { UPDATE: 'UPDATE' },
    });
  }
}

async function hasModelEntry(
  modelName: string,
  where: EntryValues
): Promise<boolean> {
  return !!(await SequelizeMock.models[modelName]?.findOne({ where }));
}

function clearSequelizeMock(): void {
  Object.values(SequelizeMock.models).forEach((model) => {
    model.entries.length = 0;
  });
}

export {
  clearSequelizeMock,
  DataTypes,
  hasModelEntry,
  Model,
  Op,
  SequelizeMock as Sequelize,
};
